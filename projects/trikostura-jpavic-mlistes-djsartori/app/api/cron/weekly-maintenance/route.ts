import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Use service role key for admin operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Run advanced maintenance
    const { data: results, error } = await supabase.rpc('perform_maintenance_advanced');

    if (error) {
      console.error('Error running maintenance:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: error.message,
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    }

    // Calculate total duration
    const totalDuration = results?.reduce((sum: number, r: any) => sum + (r.duration_ms || 0), 0) || 0;

    return NextResponse.json({
      success: true,
      message: 'Weekly maintenance completed successfully',
      results,
      totalDurationMs: totalDuration,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Maintenance cron job error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
