# Automated Maintenance Setup Guide

This guide shows you how to set up automated maintenance for your Supabase database.

## Option 1: Supabase Database Webhooks (Recommended)

### Setup:

1. **Go to Supabase Dashboard**:
   - Project: https://supabase.com/dashboard/project/fshdebfiyokhhrgqvnpz
   - Navigate to: Database > Extensions

2. **Enable pg_cron extension**:
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_cron;
   ```

3. **Schedule User Stats Refresh** (Every 15 minutes):
   ```sql
   SELECT cron.schedule(
     'refresh-user-stats-15min',
     '*/15 * * * *',  -- Every 15 minutes
     $$SELECT refresh_user_stats()$$
   );
   ```

4. **Schedule Weekly Maintenance** (Sundays at 3 AM):
   ```sql
   SELECT cron.schedule(
     'weekly-maintenance',
     '0 3 * * 0',  -- Sunday at 3:00 AM
     $$SELECT * FROM perform_maintenance_advanced()$$
   );
   ```

5. **Check Scheduled Jobs**:
   ```sql
   SELECT * FROM cron.job;
   ```

6. **View Job Run History**:
   ```sql
   SELECT 
     jobid,
     runid,
     job_pid,
     database,
     username,
     command,
     status,
     start_time,
     end_time
   FROM cron.job_run_details
   ORDER BY start_time DESC
   LIMIT 10;
   ```

---

## Option 2: External Cron (Vercel Cron Jobs)

If your app is on Vercel, you can use Vercel Cron:

### 1. Create API Route

**File**: `app/api/cron/maintenance/route.ts`

```typescript
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const supabase = await createServerSupabaseClient();

  try {
    // Refresh user stats
    const { error: refreshError } = await supabase.rpc('refresh_user_stats');
    if (refreshError) throw refreshError;

    return NextResponse.json({ 
      success: true, 
      message: 'User stats refreshed',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

**File**: `app/api/cron/weekly-maintenance/route.ts`

```typescript
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const supabase = await createServerSupabaseClient();

  try {
    const { data, error } = await supabase.rpc('perform_maintenance_advanced');
    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      results: data,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

### 2. Add to `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/maintenance",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/weekly-maintenance",
      "schedule": "0 3 * * 0"
    }
  ]
}
```

### 3. Set Environment Variable

```bash
# In Vercel Dashboard > Settings > Environment Variables
CRON_SECRET=your-random-secret-here
```

---

## Option 3: GitHub Actions

**File**: `.github/workflows/database-maintenance.yml`

```yaml
name: Database Maintenance

on:
  schedule:
    # Every 15 minutes
    - cron: '*/15 * * * *'
    # Weekly on Sunday at 3 AM
    - cron: '0 3 * * 0'
  workflow_dispatch: # Allow manual triggers

jobs:
  refresh-stats:
    runs-on: ubuntu-latest
    if: github.event.schedule == '*/15 * * * *' || github.event_name == 'workflow_dispatch'
    steps:
      - name: Refresh User Stats
        run: |
          curl -X POST 'https://fshdebfiyokhhrgqvnpz.supabase.co/rest/v1/rpc/refresh_user_stats' \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json"

  weekly-maintenance:
    runs-on: ubuntu-latest
    if: github.event.schedule == '0 3 * * 0' || github.event_name == 'workflow_dispatch'
    steps:
      - name: Run Maintenance
        run: |
          curl -X POST 'https://fshdebfiyokhhrgqvnpz.supabase.co/rest/v1/rpc/perform_maintenance_advanced' \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json"
```

---

## Option 4: Manual Setup (For Testing)

### Quick Test Commands

```bash
# Test user stats refresh
curl -X POST 'https://fshdebfiyokhhrgqvnpz.supabase.co/rest/v1/rpc/refresh_user_stats' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"

# Test maintenance
curl -X POST 'https://fshdebfiyokhhrgqvnpz.supabase.co/rest/v1/rpc/perform_maintenance_advanced' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

---

## Monitoring & Alerts

### 1. Setup Alerts in Supabase Dashboard

1. Go to Settings > Database
2. Enable performance insights
3. Set up alerts for:
   - Slow queries (> 1s)
   - High CPU usage (> 80%)
   - Low disk space (< 20%)

### 2. Log Cron Job Results

Create a logging table:

```sql
CREATE TABLE IF NOT EXISTS maintenance_logs (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  job_type text NOT NULL,
  started_at timestamptz DEFAULT NOW(),
  completed_at timestamptz,
  success boolean,
  details jsonb,
  error_message text
);

-- Index for quick lookups
CREATE INDEX idx_maintenance_logs_started 
  ON maintenance_logs(started_at DESC);
```

Update maintenance function to log:

```sql
CREATE OR REPLACE FUNCTION log_maintenance_run(
  p_job_type text,
  p_success boolean,
  p_details jsonb DEFAULT NULL,
  p_error text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO maintenance_logs (job_type, success, details, error_message, completed_at)
  VALUES (p_job_type, p_success, p_details, p_error, NOW())
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;
```

---

## Verification

### Check if pg_cron is working:

```sql
-- View all scheduled jobs
SELECT * FROM cron.job;

-- View recent job runs
SELECT 
  j.jobname,
  r.status,
  r.start_time,
  r.end_time,
  EXTRACT(EPOCH FROM (r.end_time - r.start_time)) as duration_seconds
FROM cron.job j
LEFT JOIN cron.job_run_details r ON r.jobid = j.jobid
ORDER BY r.start_time DESC
LIMIT 10;
```

### Check materialized view freshness:

```sql
SELECT 
  COUNT(*) as total_users,
  MAX(last_activity) as latest_activity
FROM user_stats_mv;
```

---

## Troubleshooting

### Issue: pg_cron not available

**Solution**: Some Supabase plans don't support pg_cron. Use Option 2 (Vercel) or Option 3 (GitHub Actions) instead.

### Issue: Functions timing out

**Solution**: Break down maintenance into smaller chunks:

```sql
-- Instead of one big maintenance job, split it:
SELECT cron.schedule('vacuum-topics', '0 2 * * *', $$VACUUM ANALYZE topics$$);
SELECT cron.schedule('vacuum-replies', '0 2 * * *', $$VACUUM ANALYZE replies$$);
SELECT cron.schedule('refresh-stats', '*/15 * * * *', $$SELECT refresh_user_stats()$$);
```

### Issue: Materialized view too slow

**Solution**: Add more specific indexes or reduce data:

```sql
-- Only include active users (posted in last 90 days)
CREATE MATERIALIZED VIEW user_stats_mv AS
SELECT ...
FROM profiles p
LEFT JOIN topics t ON t.author_id = p.id AND t.created_at > NOW() - INTERVAL '90 days'
...
```

---

## Best Practices

1. **Start Small**: Begin with Option 1 (pg_cron) if available
2. **Monitor First Week**: Check logs daily for the first week
3. **Gradual Rollout**: Start with longer intervals, then optimize
4. **Set Alerts**: Get notified if maintenance fails
5. **Log Everything**: Track all maintenance runs for debugging

---

## Recommended Schedule

| Task | Frequency | Best Time | Why |
|------|-----------|-----------|-----|
| Refresh user stats | Every 15 min | N/A | Keep stats fresh |
| Clean old notifications | Daily | 2 AM | Low traffic time |
| Clean old views | Weekly | Sunday 3 AM | Low traffic day |
| Full maintenance | Weekly | Sunday 3 AM | Comprehensive cleanup |
| REINDEX | Monthly | 1st Sunday 4 AM | Reduce index bloat |

---

**Status**: Ready to implement ✅  
**Recommended**: Option 1 (pg_cron) if available, otherwise Option 2 (Vercel)
