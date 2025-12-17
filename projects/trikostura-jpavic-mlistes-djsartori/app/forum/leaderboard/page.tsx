import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Trophy, TrendingUp, Star, Flame, Award } from 'lucide-react';
import Link from 'next/link';
import { Breadcrumb } from '@/components/forum/breadcrumb';

export const metadata = {
  title: 'Ljestvica | Skripta',
  description: 'Najbolji doprinositelji zajednice',
};

export const revalidate = 300; // Revalidate every 5 minutes

export default async function LeaderboardPage() {
  const supabase = await createServerSupabaseClient();

  // Get first day of month for filtering
  const firstDayOfMonth = new Date();
  firstDayOfMonth.setDate(1);
  firstDayOfMonth.setHours(0, 0, 0, 0);

  // PARALLEL QUERIES: Fetch all data at once
  const [
    { data: topAllTimeData },
    { data: activityThisMonth },
    { data: recentActivity }
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, avatar_url, reputation')
      .order('reputation', { ascending: false })
      .limit(10),
    supabase
      .from('user_activity')
      .select('user_id, topics_count, replies_count')
      .gte('activity_date', firstDayOfMonth.toISOString().split('T')[0]),
    // Only get last 90 days of activity for streak calculation (not ALL activity)
    supabase
      .from('user_activity')
      .select('user_id, activity_date')
      .gte('activity_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('activity_date', { ascending: false })
  ]);

  const topAllTime: any[] = topAllTimeData || [];

  // Aggregate activity by user
  const userActivityMap = new Map<string, number>();
  activityThisMonth?.forEach((activity: any) => {
    const current = userActivityMap.get(activity.user_id) || 0;
    userActivityMap.set(activity.user_id, current + activity.topics_count + activity.replies_count);
  });

  // Get profiles for top active users
  const topActiveUserIds = Array.from(userActivityMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([userId]) => userId);

  const { data: topActiveProfiles } = topActiveUserIds.length > 0
    ? await supabase
        .from('profiles')
        .select('id, username, avatar_url, reputation')
        .in('id', topActiveUserIds)
    : { data: [] as any[] };

  const topActive = (topActiveProfiles || []).map((profile: any) => ({
    ...profile,
    activityCount: userActivityMap.get(profile.id) || 0,
  })).sort((a, b) => b.activityCount - a.activityCount);

  // Calculate streaks (using only last 90 days instead of all activity)
  const streakMap = new Map<string, number>();
  const userDatesMap = new Map<string, Set<string>>();

  recentActivity?.forEach((activity: any) => {
    if (!userDatesMap.has(activity.user_id)) {
      userDatesMap.set(activity.user_id, new Set());
    }
    userDatesMap.get(activity.user_id)!.add(activity.activity_date);
  });

  // Calculate current streak for each user
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  userDatesMap.forEach((dates, userId) => {
    const sortedDates = Array.from(dates).sort().reverse();
    let streak = 0;

    for (let i = 0; i < sortedDates.length; i++) {
      const expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() - i);
      const expectedDateStr = expectedDate.toISOString().split('T')[0];

      if (sortedDates[i] === expectedDateStr) {
        streak++;
      } else {
        break;
      }
    }

    if (streak > 0) {
      streakMap.set(userId, streak);
    }
  });

  const topStreakUserIds = Array.from(streakMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([userId]) => userId);

  const { data: topStreakProfiles } = topStreakUserIds.length > 0
    ? await supabase
        .from('profiles')
        .select('id, username, avatar_url, reputation')
        .in('id', topStreakUserIds)
    : { data: [] as any[] };

  const topStreaks = (topStreakProfiles || []).map((profile: any) => ({
    ...profile,
    streak: streakMap.get(profile.id) || 0,
  })).sort((a, b) => b.streak - a.streak);

  return (
    <div className="max-w-7xl mx-auto space-y-6 px-3 sm:px-4 pb-8">
      <Breadcrumb
        items={[
          { label: 'Forum', href: '/forum' },
          { label: 'Ljestvica' },
        ]}
      />

      <div>
        <h1 className="text-3xl font-bold mb-2 xl:text-4xl">Ljestvica</h1>
        <p className="text-gray-600 dark:text-gray-400 xl:text-lg">
          Najbolji doprinositelji zajednice
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6 xl:gap-8">
        {/* All Time Leaders */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600 flex-shrink-0" />
              <span className="truncate">Svih vremena</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 sm:space-y-3">
              {topAllTime?.map((user, index) => (
                <Link
                  key={user.id}
                  href={`/forum/user/${user.username}`}
                  className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className={`text-base sm:text-lg font-bold w-5 sm:w-6 flex-shrink-0 ${
                    index === 0 ? 'text-yellow-500' :
                    index === 1 ? 'text-gray-400' :
                    index === 2 ? 'text-orange-600' :
                    'text-gray-500'
                  }`}>
                    {index + 1}
                  </div>
                  <Avatar
                    src={user.avatar_url}
                    alt={user.username}
                    username={user.username}
                    size="sm"
                    className="flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="font-semibold truncate text-sm sm:text-base">{user.username}</div>
                    <div className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">{user.reputation} RP</div>
                  </div>
                  {index < 3 && (
                    <Award className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${
                      index === 0 ? 'text-yellow-500' :
                      index === 1 ? 'text-gray-400' :
                      'text-orange-600'
                    }`} />
                  )}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Most Active This Month */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
              <span className="truncate">Ovaj mjesec</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 sm:space-y-3">
              {topActive?.map((user, index) => (
                <Link
                  key={user.id}
                  href={`/forum/user/${user.username}`}
                  className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="text-base sm:text-lg font-bold w-5 sm:w-6 flex-shrink-0 text-gray-500">
                    {index + 1}
                  </div>
                  <Avatar
                    src={user.avatar_url}
                    alt={user.username}
                    username={user.username}
                    size="sm"
                    className="flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="font-semibold truncate text-sm sm:text-base">{user.username}</div>
                    <div className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">{user.activityCount} aktivnosti</div>
                  </div>
                  {index === 0 && <Star className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 text-blue-600" />}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Longest Streaks */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 flex-shrink-0" />
              <span className="truncate">Najduži nizovi</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 sm:space-y-3">
              {topStreaks?.map((user, index) => (
                <Link
                  key={user.id}
                  href={`/forum/user/${user.username}`}
                  className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="text-base sm:text-lg font-bold w-5 sm:w-6 flex-shrink-0 text-gray-500">
                    {index + 1}
                  </div>
                  <Avatar
                    src={user.avatar_url}
                    alt={user.username}
                    username={user.username}
                    size="sm"
                    className="flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="font-semibold truncate text-sm sm:text-base">{user.username}</div>
                    <div className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">{user.streak} dana</div>
                  </div>
                  {index === 0 && <Flame className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 text-orange-600" />}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
