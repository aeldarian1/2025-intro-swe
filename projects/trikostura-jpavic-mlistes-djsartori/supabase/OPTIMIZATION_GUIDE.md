# Supabase Database Optimization Guide

## Executive Summary
This document provides comprehensive optimization recommendations for the Trikostura forum Supabase database based on analysis of the current schema and query patterns.

## 🚨 Critical Optimizations (Apply Immediately)

### 1. RLS Policy Optimization

**Problem**: Subquery-based RLS policies execute on every row check, causing massive performance degradation at scale.

**Current inefficient patterns** (found in schema.sql):
```sql
-- ❌ BAD - Runs subquery for every row
create policy "Only admins can update categories"
  on categories for update
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );
```

**Solution**: Create stable functions to cache results:

```sql
-- ✅ GOOD - Function result is cached during query
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Then update ALL admin policies:
DROP POLICY IF EXISTS "Only admins can update categories" ON categories;
CREATE POLICY "Only admins can update categories"
  ON categories FOR UPDATE
  USING (auth.is_admin());

DROP POLICY IF EXISTS "Only admins can insert categories" ON categories;
CREATE POLICY "Only admins can insert categories"
  ON categories FOR INSERT
  WITH CHECK (auth.is_admin());
```

**Apply to**: All policies in topics, replies, categories tables that check admin role.

### 2. Missing Critical Indexes

**Problem**: Foreign key columns without indexes cause full table scans on JOINs.

```sql
-- Add these immediately:
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_replies_parent_reply 
  ON replies(parent_reply_id) WHERE parent_reply_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_topics_last_reply_by 
  ON topics(last_reply_by) WHERE last_reply_by IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_topic_views_user 
  ON topic_views(user_id) WHERE user_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_topic_views_topic_user
  ON topic_views(topic_id, user_id);
```

### 3. Notification System Optimization

**Problem**: Current notification triggers can create N+1 queries and missing error handling.

**Improved notification function**:
```sql
CREATE OR REPLACE FUNCTION notify_topic_reply()
RETURNS trigger AS $$
DECLARE
  v_topic topics%ROWTYPE;
  v_actor_username text;
BEGIN
  -- Single query to get topic with JOIN
  SELECT t.*, p.username
  INTO v_topic, v_actor_username
  FROM topics t
  CROSS JOIN profiles p
  WHERE t.id = NEW.topic_id AND p.id = NEW.author_id;

  -- Notify topic author (if different from reply author)
  IF v_topic.author_id != NEW.author_id THEN
    INSERT INTO notifications (user_id, type, title, message, link, actor_id, topic_id, reply_id)
    VALUES (
      v_topic.author_id,
      'reply_to_topic',
      'Novi odgovor na tvoju temu',
      v_actor_username || ' je odgovorio/la na temu "' || v_topic.title || '"',
      '/forum/topic/' || v_topic.slug,
      NEW.author_id,
      NEW.topic_id,
      NEW.id
    )
    ON CONFLICT DO NOTHING; -- Prevent duplicate notifications
  END IF;

  -- Handle parent reply notification
  IF NEW.parent_reply_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, message, link, actor_id, topic_id, reply_id)
    SELECT 
      r.author_id,
      'reply_to_reply',
      'Novi odgovor na tvoj komentar',
      v_actor_username || ' je odgovorio/la na tvoj komentar',
      '/forum/topic/' || v_topic.slug,
      NEW.author_id,
      NEW.topic_id,
      NEW.id
    FROM replies r
    WHERE r.id = NEW.parent_reply_id 
      AND r.author_id != NEW.author_id
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'Notification creation failed: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## ⚡ Performance Optimizations

### 4. Implement Connection Pooling

Add to your Supabase client configuration:

```typescript
// lib/supabase/client.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    db: {
      schema: 'public',
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      headers: {
        'x-application-name': 'trikostura-forum',
      },
    },
    // Enable statement timeout to prevent long-running queries
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// For server-side with connection pooling
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    db: {
      schema: 'public',
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
```

### 5. Optimize View Count Tracking

**Current issue**: Every view creates a row in topic_views table.

**Better approach**:
```sql
-- Add a view counter with rate limiting
CREATE OR REPLACE FUNCTION increment_topic_view(
  p_topic_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_ip_address inet DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_last_view timestamp;
BEGIN
  -- Check if user viewed in last hour (prevent spam)
  IF p_user_id IS NOT NULL THEN
    SELECT created_at INTO v_last_view
    FROM topic_views
    WHERE topic_id = p_topic_id 
      AND user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_last_view IS NULL OR v_last_view < NOW() - INTERVAL '1 hour' THEN
      INSERT INTO topic_views (topic_id, user_id, ip_address)
      VALUES (p_topic_id, p_user_id, p_ip_address);
      
      UPDATE topics 
      SET view_count = view_count + 1 
      WHERE id = p_topic_id;
    END IF;
  ELSE
    -- Anonymous view, just increment
    UPDATE topics 
    SET view_count = view_count + 1 
    WHERE id = p_topic_id;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

### 6. Add Materialized Views for Analytics

```sql
-- Create materialized view for user statistics
CREATE MATERIALIZED VIEW user_stats AS
SELECT 
  p.id,
  p.username,
  COUNT(DISTINCT t.id) as topic_count,
  COUNT(DISTINCT r.id) as reply_count,
  COALESCE(SUM(r.upvotes), 0) as total_upvotes,
  p.reputation
FROM profiles p
LEFT JOIN topics t ON t.author_id = p.id AND t.is_locked = false
LEFT JOIN replies r ON r.author_id = p.id
GROUP BY p.id, p.username, p.reputation;

-- Create index on materialized view
CREATE UNIQUE INDEX idx_user_stats_id ON user_stats(id);
CREATE INDEX idx_user_stats_reputation ON user_stats(reputation DESC);

-- Refresh periodically (run every 15 minutes via cron)
CREATE OR REPLACE FUNCTION refresh_user_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_stats;
END;
$$ LANGUAGE plpgsql;
```

### 7. Partition Large Tables (For Future Growth)

When topics/replies exceed 100k rows:

```sql
-- Convert topics to partitioned table by year
CREATE TABLE topics_partitioned (LIKE topics INCLUDING ALL) 
PARTITION BY RANGE (created_at);

-- Create partitions
CREATE TABLE topics_2024 PARTITION OF topics_partitioned
  FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE topics_2025 PARTITION OF topics_partitioned
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
```

## 🔧 Configuration Optimizations

### 8. Supabase Project Settings

Apply these in Supabase Dashboard > Settings:

**Database Settings:**
- Statement timeout: `30s` (prevents runaway queries)
- Idle transaction timeout: `10m`
- Enable prepared statements caching

**API Settings:**
- Max rows: `1000` (prevent accidental large fetches)
- Enable PostgREST connection pooling

**Storage:**
- Add aggressive CDN caching for avatars
- Use image transformations: `width=200,height=200,quality=80`

### 9. Implement Query Patterns Best Practices

**Bad pattern** (N+1 query):
```typescript
// ❌ Fetches topics, then profiles separately
const { data: topics } = await supabase
  .from('topics')
  .select('*');

for (const topic of topics) {
  const { data: author } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', topic.author_id)
    .single();
}
```

**Good pattern** (single query with JOIN):
```typescript
// ✅ Fetches everything in one query
const { data: topics } = await supabase
  .from('topics')
  .select(`
    *,
    author:profiles!topics_author_id_fkey(id, username, avatar_url),
    category:categories(id, name, slug, color),
    last_replier:profiles!topics_last_reply_by_fkey(id, username)
  `)
  .order('created_at', { ascending: false })
  .limit(20);
```

### 10. Add Database Maintenance Tasks

Create scheduled functions (via pg_cron or external cron):

```sql
-- Weekly vacuum and analyze
CREATE OR REPLACE FUNCTION weekly_maintenance()
RETURNS void AS $$
BEGIN
  VACUUM ANALYZE topics;
  VACUUM ANALYZE replies;
  VACUUM ANALYZE votes;
  VACUUM ANALYZE notifications;
  
  -- Clean old notifications (older than 30 days and read)
  DELETE FROM notifications 
  WHERE is_read = true 
    AND created_at < NOW() - INTERVAL '30 days';
    
  -- Archive old topic views (optional)
  DELETE FROM topic_views 
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;
```

## 📊 Monitoring Setup

### 11. Add Query Performance Logging

```sql
-- Enable slow query logging
ALTER DATABASE postgres SET log_min_duration_statement = '1000'; -- 1 second

-- Create table to track slow queries
CREATE TABLE IF NOT EXISTS query_performance_log (
  id serial PRIMARY KEY,
  query_text text,
  execution_time_ms integer,
  user_id uuid,
  created_at timestamp DEFAULT NOW()
);

-- Function to log slow queries from application
CREATE OR REPLACE FUNCTION log_slow_query(
  p_query text,
  p_duration_ms integer,
  p_user_id uuid DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  IF p_duration_ms > 1000 THEN
    INSERT INTO query_performance_log (query_text, execution_time_ms, user_id)
    VALUES (p_query, p_duration_ms, p_user_id);
  END IF;
END;
$$ LANGUAGE plpgsql;
```

## 🎯 Implementation Priority

1. **Immediate (Today)**: 
   - RLS policy optimization (#1)
   - Missing indexes (#2)

2. **This Week**:
   - Notification optimization (#3)
   - View count optimization (#5)
   - Query pattern fixes (#9)

3. **This Month**:
   - Connection pooling (#4)
   - Materialized views (#6)
   - Maintenance tasks (#10)

4. **Future (When Needed)**:
   - Table partitioning (#7)
   - Advanced monitoring (#11)

## ✅ Verification Queries

Run these to verify optimizations:

```sql
-- Check all indexes
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Find missing indexes on foreign keys
SELECT 
  tc.table_name, 
  kcu.column_name,
  tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = tc.table_name 
      AND indexdef LIKE '%' || kcu.column_name || '%'
  );

-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_total_relation_size(schemaname||'.'||tablename) AS bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Find slowest queries (requires pg_stat_statements extension)
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
ORDER BY mean_time DESC
LIMIT 20;
```

## 🔗 Additional Resources

- [Supabase Performance Docs](https://supabase.com/docs/guides/platform/performance)
- [PostgreSQL Index Tuning](https://www.postgresql.org/docs/current/indexes.html)
- [RLS Performance Guide](https://supabase.com/docs/guides/database/postgres/row-level-security#rls-performance-recommendations)
