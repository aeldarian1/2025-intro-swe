-- ============================================
-- AUTOMATED MAINTENANCE SETUP
-- ============================================
-- This script sets up pg_cron for automated maintenance
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant permissions to use pg_cron
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- ============================================
-- 1. REFRESH USER STATS (Every 15 minutes)
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-user-stats-15min') THEN
    PERFORM cron.unschedule('refresh-user-stats-15min');
  END IF;
END $$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'refresh-user-stats-15min',
    '*/15 * * * *',
    $cmd$SELECT refresh_user_stats()$cmd$
  );
END $$;

-- ============================================
-- 2. WEEKLY MAINTENANCE (Sundays at 3 AM UTC)
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-maintenance') THEN
    PERFORM cron.unschedule('weekly-maintenance');
  END IF;
END $$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'weekly-maintenance',
    '0 3 * * 0',
    $cmd$SELECT perform_maintenance_advanced()$cmd$
  );
END $$;

-- ============================================
-- 3. DAILY CLEANUP (Every day at 2 AM UTC)
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-cleanup') THEN
    PERFORM cron.unschedule('daily-cleanup');
  END IF;
END $$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'daily-cleanup',
    '0 2 * * *',
    $cmd$DELETE FROM notifications WHERE is_read = true AND created_at < NOW() - INTERVAL '30 days'; DELETE FROM topic_views WHERE user_id IS NULL AND created_at < NOW() - INTERVAL '90 days'$cmd$
  );
END $$;

-- ============================================
-- 4. VERIFY SCHEDULED JOBS
-- ============================================

-- Check all scheduled jobs
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active,
  database
FROM cron.job
ORDER BY jobname;

-- ============================================
-- 5. VIEW JOB RUN HISTORY
-- ============================================

-- See recent job runs
SELECT 
  j.jobname,
  r.status,
  r.start_time,
  r.end_time,
  EXTRACT(EPOCH FROM (r.end_time - r.start_time))::integer as duration_seconds,
  r.return_message
FROM cron.job j
LEFT JOIN cron.job_run_details r ON r.jobid = j.jobid
ORDER BY r.start_time DESC
LIMIT 20;

-- ============================================
-- 6. CREATE MONITORING VIEW
-- ============================================

CREATE OR REPLACE VIEW cron_job_health AS
SELECT 
  j.jobname,
  j.active,
  COUNT(r.runid) FILTER (WHERE r.start_time > NOW() - INTERVAL '24 hours') as runs_last_24h,
  COUNT(r.runid) FILTER (WHERE r.status = 'failed' AND r.start_time > NOW() - INTERVAL '24 hours') as failures_last_24h,
  MAX(r.start_time) as last_run,
  AVG(EXTRACT(EPOCH FROM (r.end_time - r.start_time)))::integer as avg_duration_seconds
FROM cron.job j
LEFT JOIN cron.job_run_details r ON r.jobid = j.jobid
GROUP BY j.jobid, j.jobname, j.active
ORDER BY j.jobname;

-- Check cron job health
SELECT * FROM cron_job_health;

-- ============================================
-- SETUP COMPLETE
-- ============================================

-- You should see 3 scheduled jobs:
-- 1. refresh-user-stats-15min (runs every 15 minutes)
-- 2. weekly-maintenance (runs Sundays at 3 AM)
-- 3. daily-cleanup (runs daily at 2 AM)

-- Verify setup
SELECT 'Automated maintenance setup complete!' as status;
SELECT 'Check scheduled jobs with: SELECT * FROM cron.job;' as next_step;
SELECT 'Monitor health with: SELECT * FROM cron_job_health;' as monitoring;
