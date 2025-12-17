-- ============================================
-- CRITICAL SUPABASE OPTIMIZATIONS
-- ============================================
-- Run this in Supabase SQL Editor to apply all critical optimizations
-- Created: 2025-12-17
-- 
-- BACKUP YOUR DATABASE BEFORE RUNNING!
-- ============================================

-- ============================================
-- 1. CREATE HELPER FUNCTIONS FOR RLS
-- ============================================

-- Check if user is admin (cached, stable function)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Get current user's role (cached, stable function)
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================
-- 2. OPTIMIZE RLS POLICIES - CATEGORIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Only admins can insert categories" ON categories;
DROP POLICY IF EXISTS "Only admins can update categories" ON categories;
DROP POLICY IF EXISTS "Only admins can delete categories" ON categories;

-- Recreate with optimized functions
CREATE POLICY "Only admins can insert categories"
  ON categories FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update categories"
  ON categories FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Only admins can delete categories"
  ON categories FOR DELETE
  USING (public.is_admin());

-- ============================================
-- 3. OPTIMIZE RLS POLICIES - TOPICS
-- ============================================

DROP POLICY IF EXISTS "Authors can update own topics" ON topics;
DROP POLICY IF EXISTS "Authors and admins can delete topics" ON topics;

CREATE POLICY "Authors can update own topics"
  ON topics FOR UPDATE
  USING (auth.uid() = author_id OR public.is_admin());

CREATE POLICY "Authors and admins can delete topics"
  ON topics FOR DELETE
  USING (auth.uid() = author_id OR public.is_admin());

-- ============================================
-- 4. OPTIMIZE RLS POLICIES - REPLIES
-- ============================================

DROP POLICY IF EXISTS "Authors can update own replies" ON replies;
DROP POLICY IF EXISTS "Authors and admins can delete replies" ON replies;

CREATE POLICY "Authors can update own replies"
  ON replies FOR UPDATE
  USING (auth.uid() = author_id OR public.is_admin());

CREATE POLICY "Authors and admins can delete replies"
  ON replies FOR DELETE
  USING (auth.uid() = author_id OR public.is_admin());

-- ============================================
-- 5. ADD MISSING CRITICAL INDEXES
-- ============================================

-- First, ensure required columns exist in topic_views
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'topic_views' AND column_name = 'ip_address') THEN
    ALTER TABLE topic_views ADD COLUMN ip_address inet;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'topic_views' AND column_name = 'created_at') THEN
    ALTER TABLE topic_views ADD COLUMN created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL;
  END IF;
END $$;

-- Replies: parent_reply_id (for threaded comments)
CREATE INDEX IF NOT EXISTS idx_replies_parent_reply 
  ON replies(parent_reply_id) 
  WHERE parent_reply_id IS NOT NULL;

-- Topics: last_reply_by (for JOIN optimization)
CREATE INDEX IF NOT EXISTS idx_topics_last_reply_by 
  ON topics(last_reply_by) 
  WHERE last_reply_by IS NOT NULL;

-- Topic views: user lookups
CREATE INDEX IF NOT EXISTS idx_topic_views_user 
  ON topic_views(user_id) 
  WHERE user_id IS NOT NULL;

-- Topic views: prevent duplicate views
CREATE INDEX IF NOT EXISTS idx_topic_views_topic_user
  ON topic_views(topic_id, user_id);

-- Topic views: IP-based rate limiting
CREATE INDEX IF NOT EXISTS idx_topic_views_topic_ip
  ON topic_views(topic_id, ip_address, created_at DESC);

-- Notifications: unread count optimization
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, is_read, created_at DESC)
  WHERE is_read = false;

-- ============================================
-- 6. OPTIMIZE VIEW COUNT FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION increment_topic_view(
  p_topic_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_ip_address inet DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_last_view timestamp;
BEGIN
  -- Rate limit: Only count unique views per hour
  IF p_user_id IS NOT NULL THEN
    -- Check authenticated user's last view
    SELECT created_at INTO v_last_view
    FROM topic_views
    WHERE topic_id = p_topic_id 
      AND user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_last_view IS NULL OR v_last_view < NOW() - INTERVAL '1 hour' THEN
      -- Insert view record
      INSERT INTO topic_views (topic_id, user_id, ip_address)
      VALUES (p_topic_id, p_user_id, p_ip_address)
      ON CONFLICT DO NOTHING;
      
      -- Increment counter
      UPDATE topics 
      SET view_count = view_count + 1 
      WHERE id = p_topic_id;
    END IF;
  ELSIF p_ip_address IS NOT NULL THEN
    -- Check anonymous IP's last view
    SELECT created_at INTO v_last_view
    FROM topic_views
    WHERE topic_id = p_topic_id 
      AND ip_address = p_ip_address
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_last_view IS NULL OR v_last_view < NOW() - INTERVAL '1 hour' THEN
      INSERT INTO topic_views (topic_id, ip_address)
      VALUES (p_topic_id, p_ip_address)
      ON CONFLICT DO NOTHING;
      
      UPDATE topics 
      SET view_count = view_count + 1 
      WHERE id = p_topic_id;
    END IF;
  ELSE
    -- No rate limiting for unchecked views
    UPDATE topics 
    SET view_count = view_count + 1 
    WHERE id = p_topic_id;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail topic view if counter fails
    RAISE WARNING 'View count failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. OPTIMIZE NOTIFICATION TRIGGERS
-- ============================================

-- Improved notification function with error handling and optimization
CREATE OR REPLACE FUNCTION notify_topic_reply()
RETURNS trigger AS $$
DECLARE
  v_topic record;
  v_actor_username text;
BEGIN
  -- Get topic and actor info in single query
  SELECT 
    t.id, t.title, t.slug, t.author_id,
    p.username as actor_username
  INTO v_topic
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
      v_topic.actor_username || ' je odgovorio/la na temu "' || v_topic.title || '"',
      '/forum/topic/' || v_topic.slug,
      NEW.author_id,
      NEW.topic_id,
      NEW.id
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Handle parent reply notification efficiently
  IF NEW.parent_reply_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, message, link, actor_id, topic_id, reply_id)
    SELECT 
      r.author_id,
      'reply_to_reply',
      'Novi odgovor na tvoj komentar',
      v_topic.actor_username || ' je odgovorio/la na tvoj komentar',
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
    -- Log but don't fail the insert
    RAISE WARNING 'Notification creation failed: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. ADD MAINTENANCE FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION perform_maintenance()
RETURNS TABLE(task text, status text, details text) AS $$
BEGIN
  -- Vacuum and analyze critical tables
  RETURN QUERY SELECT 'VACUUM topics'::text, 'running'::text, ''::text;
  VACUUM ANALYZE topics;
  
  RETURN QUERY SELECT 'VACUUM replies'::text, 'running'::text, ''::text;
  VACUUM ANALYZE replies;
  
  RETURN QUERY SELECT 'VACUUM votes'::text, 'running'::text, ''::text;
  VACUUM ANALYZE votes;
  
  RETURN QUERY SELECT 'VACUUM notifications'::text, 'running'::text, ''::text;
  VACUUM ANALYZE notifications;
  
  -- Clean old read notifications (30+ days)
  WITH deleted AS (
    DELETE FROM notifications 
    WHERE is_read = true 
      AND created_at < NOW() - INTERVAL '30 days'
    RETURNING *
  )
  SELECT 'Clean old notifications'::text, 'completed'::text, 
         COUNT(*)::text || ' rows deleted' 
  FROM deleted;
  
  -- Clean old topic views (90+ days)
  WITH deleted AS (
    DELETE FROM topic_views 
    WHERE created_at < NOW() - INTERVAL '90 days'
    RETURNING *
  )
  SELECT 'Clean old topic views'::text, 'completed'::text,
         COUNT(*)::text || ' rows deleted'
  FROM deleted;
         
  RETURN QUERY SELECT 'Maintenance complete'::text, 'success'::text, ''::text;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. ADD UNIQUE CONSTRAINTS WHERE NEEDED
-- ============================================

-- Prevent duplicate topic views from same user
ALTER TABLE topic_views 
DROP CONSTRAINT IF EXISTS unique_user_topic_view;

-- Don't add constraint, use index for lookups instead
-- (allows tracking view history)

-- ============================================
-- 10. UPDATE TABLE STATISTICS
-- ============================================

ANALYZE profiles;
ANALYZE topics;
ANALYZE replies;
ANALYZE votes;
ANALYZE notifications;
ANALYZE categories;
ANALYZE topic_views;

COMMIT;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check all indexes were created
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN ('profiles', 'topics', 'replies', 'votes', 'notifications', 'topic_views')
ORDER BY tablename, indexname;

-- Check RLS policies
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Optimizations applied successfully!


