import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Eye, TrendingUp, Folder, Users } from 'lucide-react';
import { formatDistanceToNow } from '@/lib/utils';

interface TopicSidebarProps {
  category: {
    id: string;
    name: string;
    slug: string;
    icon: string;
    color: string;
    description?: string;
  };
  relatedTopics?: Array<{
    id: string;
    title: string;
    slug: string;
    reply_count: number;
    view_count: number;
    created_at: string;
  }>;
  stats?: {
    totalTopics: number;
    totalReplies: number;
    activeUsers: number;
  };
}

export function TopicSidebar({ category, relatedTopics, stats }: TopicSidebarProps) {
  return (
    <aside className="hidden lg:block lg:w-80 xl:w-96 flex-shrink-0 space-y-4">
      {/* Category Info */}
      <Card className="border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Folder className="w-4 h-4 text-primary" />
            Kategorija
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Link
            href={`/forum/category/${category.slug}`}
            className="block group"
          >
            <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <div
                className="text-2xl flex items-center justify-center w-12 h-12 rounded-lg flex-shrink-0 transition-transform group-hover:scale-110"
                style={{ backgroundColor: category.color + '20' }}
              >
                {category.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-primary transition-colors">
                  {category.name}
                </h3>
                {category.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
                    {category.description}
                  </p>
                )}
              </div>
            </div>
          </Link>

          {stats && (
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {stats.totalTopics}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Tema</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {stats.totalReplies}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Odgovora</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {stats.activeUsers}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Korisnika</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Related Topics */}
      {relatedTopics && relatedTopics.length > 0 && (
        <Card className="border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Slične teme
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {relatedTopics.slice(0, 5).map((topic) => (
                <Link
                  key={topic.id}
                  href={`/forum/topic/${topic.slug}`}
                  className="block group p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                    {topic.title}
                  </h4>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {topic.reply_count}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {topic.view_count}
                    </span>
                    <span className="flex-1 text-right truncate">
                      {formatDistanceToNow(new Date(topic.created_at))}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card className="border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Brze akcije</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Link
              href={`/forum/category/${category.slug}`}
              className="block text-sm text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors py-1"
            >
              → Sve teme u {category.name}
            </Link>
            <Link
              href="/forum/new"
              className="block text-sm text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors py-1"
            >
              → Nova tema
            </Link>
            <Link
              href="/forum/search"
              className="block text-sm text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors py-1"
            >
              → Pretraga
            </Link>
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}
