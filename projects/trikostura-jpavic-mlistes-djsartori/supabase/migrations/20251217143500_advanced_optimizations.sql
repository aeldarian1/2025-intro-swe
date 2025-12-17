-- ============================================
-- ADVANCED SUPABASE OPTIMIZATIONS - PART 2
-- ============================================
-- Additional performance improvements
-- Created: 2025-12-17
-- Run after: 20251217142936_performance_optimizations.sql
-- ============================================

-- ============================================
-- 1. ADVANCED COMPOSITE INDEXES
-- ============================================

-- Homepage trending topics (view_count + created_at filter)
CREATE INDEX IF NOT EXISTS idx_topics_trending 
  ON topics(created_at DESC, view_count DESC, reply_count DESC)
  WHERE is_locked = false;

-- Category page optimization (category + pinned + created)
CREATE INDEX IF NOT EXISTS idx_topics_category_pinned_created
  ON topics(category_id, is_pinned DESC, created_at DESC)
  WHERE is_locked = false;

-- Solved topics filtering
CREATE INDEX IF NOT EXISTS idx_topics_has_solution_created
  ON topics(has_solution, created_at DESC)
  WHERE is_locked = false;

-- User profile - topics by author with solution
CREATE INDEX IF NOT EXISTS idx_topics_author_solution
  ON topics(author_id, has_solution, created_at DESC);

-- Replies with upvotes (leaderboard queries)
CREATE INDEX IF NOT EXISTS idx_replies_upvotes_created
  ON replies(upvotes DESC, created_at DESC);

-- Notifications: type-based filtering
CREATE INDEX IF NOT EXISTS idx_notifications_user_type_created
  ON notifications(user_id, type, created_at DESC);

-- Bookmarks JOIN optimization
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bookmarks') THEN
    CREATE INDEX IF NOT EXISTS idx_bookmarks_user_created
      ON bookmarks(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_topic_user
      ON bookmarks(topic_id, user_id);
  END IF;
END $$;

-- ============================================
-- 2. MATERIALIZED VIEW FOR USER STATS
-- ============================================

-- Drop existing view if exists
DROP MATERIALIZED VIEW IF EXISTS user_stats_mv CASCADE;

-- Create optimized materialized view
CREATE MATERIALIZED VIEW user_stats_mv AS
SELECT 
  p.id,
  p.username,
  p.avatar_url,
  p.reputation,
  p.created_at as joined_at,
  COUNT(DISTINCT t.id) FILTER (WHERE t.is_locked = false) as topic_count,
  COUNT(DISTINCT r.id) as reply_count,
  COALESCE(SUM(t.view_count), 0) as total_views,
  COALESCE(SUM(r.upvotes), 0) as total_upvotes,
  COUNT(DISTINCT t.id) FILTER (WHERE t.has_solution = true) as solved_topics,
  MAX(GREATEST(t.created_at, r.created_at)) as last_activity
FROM profiles p
LEFT JOIN topics t ON t.author_id = p.id
LEFT JOIN replies r ON r.author_id = p.id
GROUP BY p.id, p.username, p.avatar_url, p.reputation, p.created_at;

-- Create indexes on materialized view
CREATE UNIQUE INDEX idx_user_stats_mv_id ON user_stats_mv(id);
CREATE INDEX idx_user_stats_mv_reputation ON user_stats_mv(reputation DESC);
CREATE INDEX idx_user_stats_mv_topics ON user_stats_mv(topic_count DESC);
CREATE INDEX idx_user_stats_mv_replies ON user_stats_mv(reply_count DESC);
CREATE INDEX idx_user_stats_mv_upvotes ON user_stats_mv(total_upvotes DESC);
CREATE INDEX idx_user_stats_mv_activity ON user_stats_mv(last_activity DESC);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_user_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_stats_mv;
EXCEPTION
  WHEN OTHERS THEN
    -- Fallback to non-concurrent refresh if concurrent fails
    REFRESH MATERIALIZED VIEW user_stats_mv;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. OPTIMIZE NOTIFICATION CREATION (BATCH)
-- ============================================

-- Create function to batch-create notifications
CREATE OR REPLACE FUNCTION create_notifications_batch(
  p_notifications jsonb
)
RETURNS integer AS $$
DECLARE
  v_count integer := 0;
  v_notification jsonb;
BEGIN
  FOR v_notification IN SELECT * FROM jsonb_array_elements(p_notifications)
  LOOP
    -- Skip if notifying self
    IF (v_notification->>'user_id')::uuid = (v_notification->>'actor_id')::uuid THEN
      CONTINUE;
    END IF;
    
    INSERT INTO notifications (
      user_id, 
      type, 
      title, 
      message, 
      link, 
      actor_id, 
      topic_id, 
      reply_id
    )
    VALUES (
      (v_notification->>'user_id')::uuid,
      (v_notification->>'type')::notification_type,
      v_notification->>'title',
      v_notification->>'message',
      v_notification->>'link',
      (v_notification->>'actor_id')::uuid,
      (v_notification->>'topic_id')::uuid,
      (v_notification->>'reply_id')::uuid
    )
    ON CONFLICT DO NOTHING;
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Batch notification creation failed: %', SQLERRM;
    RETURN 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. CACHED CATEGORY STATS FUNCTION
-- ============================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_category_stats CASCADE;

CREATE OR REPLACE FUNCTION get_category_stats()
RETURNS TABLE(
  category_id uuid,
  topic_count bigint,
  latest_topic_id uuid,
  latest_topic_slug text,
  latest_topic_title text,
  latest_topic_created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  WITH topic_counts AS (
    SELECT 
      t.category_id,
      COUNT(*) as topic_count,
      MAX(t.created_at) as latest_created
    FROM topics t
    WHERE t.is_locked = false
    GROUP BY t.category_id
  ),
  latest_topics AS (
    SELECT DISTINCT ON (t.category_id)
      t.category_id,
      t.id,
      t.slug,
      t.title,
      t.created_at
    FROM topics t
    WHERE t.is_locked = false
    ORDER BY t.category_id, t.created_at DESC
  )
  SELECT 
    tc.category_id,
    tc.topic_count,
    lt.id,
    lt.slug,
    lt.title,
    lt.created_at
  FROM topic_counts tc
  LEFT JOIN latest_topics lt ON lt.category_id = tc.category_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 5. OPTIMIZE TOPIC LISTING QUERY
-- ============================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_topics_paginated CASCADE;

CREATE OR REPLACE FUNCTION get_topics_paginated(
  p_limit integer DEFAULT 15,
  p_offset integer DEFAULT 0,
  p_category_id uuid DEFAULT NULL,
  p_filter text DEFAULT 'all'  -- 'all', 'solved', 'unsolved'
)
RETURNS TABLE(
  id uuid,
  title text,
  slug text,
  created_at timestamptz,
  is_pinned boolean,
  is_locked boolean,
  has_solution boolean,
  view_count integer,
  reply_count integer,
  category_id uuid,
  category_name text,
  category_slug text,
  category_color text,
  author_username text,
  author_avatar_url text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.title,
    t.slug,
    t.created_at,
    t.is_pinned,
    t.is_locked,
    t.has_solution,
    t.view_count,
    t.reply_count,
    t.category_id,
    c.name as category_name,
    c.slug as category_slug,
    c.color as category_color,
    p.username as author_username,
    p.avatar_url as author_avatar_url
  FROM topics t
  LEFT JOIN categories c ON c.id = t.category_id
  LEFT JOIN profiles p ON p.id = t.author_id
  WHERE 
    (p_category_id IS NULL OR t.category_id = p_category_id)
    AND (
      p_filter = 'all' OR
      (p_filter = 'solved' AND t.has_solution = true) OR
      (p_filter = 'unsolved' AND (t.has_solution IS NULL OR t.has_solution = false))
    )
  ORDER BY 
    t.is_pinned DESC,
    t.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 6. BATCH UPDATE REPLY COUNTS
-- ============================================

CREATE OR REPLACE FUNCTION recalculate_topic_reply_counts(
  p_topic_ids uuid[] DEFAULT NULL
)
RETURNS integer AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  UPDATE topics t
  SET reply_count = (
    SELECT COUNT(*)
    FROM replies r
    WHERE r.topic_id = t.id
  )
  WHERE p_topic_ids IS NULL OR t.id = ANY(p_topic_ids);
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. OPTIMIZE VOTE AGGREGATION
-- ============================================

CREATE OR REPLACE FUNCTION recalculate_reply_votes(
  p_reply_ids uuid[] DEFAULT NULL
)
RETURNS integer AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  UPDATE replies r
  SET 
    upvotes = (
      SELECT COUNT(*)
      FROM votes v
      WHERE v.reply_id = r.id AND v.vote_type = 1
    ),
    downvotes = (
      SELECT COUNT(*)
      FROM votes v
      WHERE v.reply_id = r.id AND v.vote_type = -1
    )
  WHERE p_reply_ids IS NULL OR r.id = ANY(p_reply_ids);
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. ENHANCED MAINTENANCE FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION perform_maintenance_advanced()
RETURNS TABLE(task text, status text, details text, duration_ms integer) AS $$
DECLARE
  v_start_time timestamp;
  v_end_time timestamp;
  v_deleted_count integer;
BEGIN
  -- Vacuum and analyze
  v_start_time := clock_timestamp();
  VACUUM ANALYZE topics, replies, votes, notifications, profiles;
  v_end_time := clock_timestamp();
  
  RETURN QUERY SELECT 
    'VACUUM ANALYZE'::text,
    'completed'::text,
    'All main tables optimized'::text,
    EXTRACT(MILLISECONDS FROM v_end_time - v_start_time)::integer;
  
  -- Clean old read notifications
  v_start_time := clock_timestamp();
  DELETE FROM notifications 
  WHERE is_read = true 
    AND created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_end_time := clock_timestamp();
  
  RETURN QUERY SELECT 
    'Clean old notifications'::text,
    'completed'::text,
    v_deleted_count::text || ' rows deleted'::text,
    EXTRACT(MILLISECONDS FROM v_end_time - v_start_time)::integer;
  
  -- Clean old topic views
  v_start_time := clock_timestamp();
  DELETE FROM topic_views 
  WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_end_time := clock_timestamp();
  
  RETURN QUERY SELECT 
    'Clean old topic views'::text,
    'completed'::text,
    v_deleted_count::text || ' rows deleted'::text,
    EXTRACT(MILLISECONDS FROM v_end_time - v_start_time)::integer;
  
  -- Refresh user stats materialized view
  v_start_time := clock_timestamp();
  PERFORM refresh_user_stats();
  v_end_time := clock_timestamp();
  
  RETURN QUERY SELECT 
    'Refresh user stats'::text,
    'completed'::text,
    'Materialized view updated'::text,
    EXTRACT(MILLISECONDS FROM v_end_time - v_start_time)::integer;
  
  -- Reindex if fragmentation is high
  v_start_time := clock_timestamp();
  REINDEX TABLE CONCURRENTLY topics;
  REINDEX TABLE CONCURRENTLY replies;
  v_end_time := clock_timestamp();
  
  RETURN QUERY SELECT 
    'REINDEX tables'::text,
    'completed'::text,
    'Topics and replies reindexed'::text,
    EXTRACT(MILLISECONDS FROM v_end_time - v_start_time)::integer;
    
  RETURN QUERY SELECT 
    'Maintenance complete'::text,
    'success'::text,
    'All tasks finished'::text,
    0::integer;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. ADD PARTIAL INDEXES FOR COMMON FILTERS
-- ============================================

-- Pinned topics only
CREATE INDEX IF NOT EXISTS idx_topics_pinned_only
  ON topics(category_id, created_at DESC)
  WHERE is_pinned = true;

-- Unlocked topics only (most common filter)
CREATE INDEX IF NOT EXISTS idx_topics_unlocked_created
  ON topics(created_at DESC)
  WHERE is_locked = false;

-- Topics with solutions
CREATE INDEX IF NOT EXISTS idx_topics_solved_created
  ON topics(created_at DESC)
  WHERE has_solution = true;

-- Unread notifications (most common query)
CREATE INDEX IF NOT EXISTS idx_notifications_unread_user
  ON notifications(user_id, created_at DESC)
  WHERE is_read = false;

-- ============================================
-- 10. UPDATE STATISTICS
-- ============================================

ANALYZE topics;
ANALYZE replies;
ANALYZE votes;
ANALYZE notifications;
ANALYZE profiles;
ANALYZE categories;

-- ============================================
-- VERIFICATION QUERY
-- ============================================

-- Check all new indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(schemaname||'.'||indexname)) as index_size
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY pg_relation_size(schemaname||'.'||indexname) DESC;

-- Optimizations Part 2 applied successfully!
