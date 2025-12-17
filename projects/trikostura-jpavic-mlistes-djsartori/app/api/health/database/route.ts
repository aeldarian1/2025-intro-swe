import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Health check and monitoring endpoint
export async function GET(request: Request) {
  try {
    // Optional: Verify admin access
    const authHeader = request.headers.get('authorization');
    const isAdmin = authHeader === `Bearer ${process.env.CRON_SECRET}`;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      isAdmin ? process.env.SUPABASE_SERVICE_ROLE_KEY! : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get database health metrics
    const [
      { count: topicCount },
      { count: replyCount },
      { count: userCount },
      { data: recentTopics },
      { data: userStats }
    ] = await Promise.all([
      supabase.from('topics').select('*', { count: 'exact', head: true }),
      supabase.from('replies').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('topics').select('created_at').order('created_at', { ascending: false }).limit(1),
      supabase.from('user_stats_mv').select('last_activity').order('last_activity', { ascending: false }).limit(1)
    ]);

    const latestTopic = recentTopics?.[0]?.created_at;
    const latestActivity = userStats?.[0]?.last_activity;

    // Calculate materialized view freshness
    const viewFreshness = latestTopic && latestActivity 
      ? Math.floor((new Date(latestTopic).getTime() - new Date(latestActivity).getTime()) / 1000 / 60)
      : null;

    return NextResponse.json({
      status: 'healthy',
      database: {
        topics: topicCount || 0,
        replies: replyCount || 0,
        users: userCount || 0,
      },
      materializedView: {
        lastRefresh: latestActivity,
        freshnessMinutes: viewFreshness,
        isStale: viewFreshness !== null && viewFreshness > 30,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { 
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
