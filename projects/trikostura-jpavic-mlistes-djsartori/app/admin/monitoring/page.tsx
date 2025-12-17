'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

interface DatabaseHealth {
  status: string;
  database: {
    topics: number;
    replies: number;
    users: number;
  };
  materializedView: {
    lastRefresh: string;
    freshnessMinutes: number;
    isStale: boolean;
  };
  timestamp: string;
}

interface CronJobHealth {
  jobname: string;
  active: boolean;
  runs_last_24h: number;
  failures_last_24h: number;
  last_run: string | null;
  avg_duration_seconds: number | null;
}

export default function DatabaseMonitoringDashboard() {
  const [health, setHealth] = useState<DatabaseHealth | null>(null);
  const [cronJobs, setCronJobs] = useState<CronJobHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchHealth = async () => {
    try {
      const response = await fetch('/api/health/database');
      const data = await response.json();
      setHealth(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchCronJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('cron_job_health')
        .select('*')
        .order('jobname');

      if (error) throw error;
      setCronJobs(data || []);
    } catch (err: any) {
      console.error('Error fetching cron jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshStats = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.rpc('refresh_user_stats');
      if (error) throw error;
      await fetchHealth();
      alert('User statistics refreshed successfully!');
    } catch (err: any) {
      alert('Error refreshing stats: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const runMaintenance = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('perform_maintenance_advanced');
      if (error) throw error;
      
      const results = data as Array<{task: string; status: string; details: string; duration_ms: number}>;
      const summary = results
        .map(r => `${r.task}: ${r.status} (${r.duration_ms}ms)`)
        .join('\n');
      
      alert('Maintenance completed:\n\n' + summary);
    } catch (err: any) {
      alert('Error running maintenance: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    fetchCronJobs();
    
    // Refresh every minute
    const interval = setInterval(() => {
      fetchHealth();
      fetchCronJobs();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  if (loading && !health) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Database Monitoring</h1>
        <div className="space-x-2">
          <button
            onClick={refreshStats}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Refresh Stats
          </button>
          <button
            onClick={runMaintenance}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            Run Maintenance
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Health Status */}
      {health && (
        <div className={`p-6 rounded-lg border-2 ${
          health.status === 'healthy' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}>
          <h2 className="text-xl font-semibold mb-4">
            Status: <span className="uppercase">{health.status}</span>
          </h2>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded shadow">
              <div className="text-3xl font-bold text-blue-600">{health.database.topics}</div>
              <div className="text-sm text-gray-600">Topics</div>
            </div>
            <div className="bg-white p-4 rounded shadow">
              <div className="text-3xl font-bold text-purple-600">{health.database.replies}</div>
              <div className="text-sm text-gray-600">Replies</div>
            </div>
            <div className="bg-white p-4 rounded shadow">
              <div className="text-3xl font-bold text-green-600">{health.database.users}</div>
              <div className="text-sm text-gray-600">Users</div>
            </div>
          </div>

          <div className={`mt-4 p-4 rounded ${
            health.materializedView.isStale ? 'bg-yellow-100' : 'bg-gray-100'
          }`}>
            <div className="font-semibold mb-2">Materialized View Status</div>
            <div className="text-sm space-y-1">
              <div>Last Refresh: {new Date(health.materializedView.lastRefresh).toLocaleString()}</div>
              <div>Freshness: {health.materializedView.freshnessMinutes} minutes ago</div>
              <div>
                {health.materializedView.isStale ? (
                  <span className="text-yellow-700 font-semibold">⚠️ Stale (30+ minutes)</span>
                ) : (
                  <span className="text-green-700">✓ Fresh</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cron Jobs */}
      {cronJobs.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Automated Jobs</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Job Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Run
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    24h Runs
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Failures
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Duration
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {cronJobs.map((job) => (
                  <tr key={job.jobname}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {job.jobname}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {job.active ? (
                        <span className="text-green-600">● Active</span>
                      ) : (
                        <span className="text-red-600">○ Inactive</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {job.last_run ? new Date(job.last_run).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {job.runs_last_24h}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {job.failures_last_24h > 0 ? (
                        <span className="text-red-600 font-semibold">{job.failures_last_24h}</span>
                      ) : (
                        <span className="text-green-600">0</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {job.avg_duration_seconds ? `${job.avg_duration_seconds}s` : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="text-xs text-gray-500 text-center">
        Last updated: {health?.timestamp ? new Date(health.timestamp).toLocaleString() : 'Never'}
      </div>
    </div>
  );
}
