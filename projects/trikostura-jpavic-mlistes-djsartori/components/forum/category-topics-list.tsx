'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { ViewToggle } from '@/components/ui/view-toggle';
import { TopicTable } from '@/components/forum/topic-table';
import { MessageSquare, Pin, CheckCircle } from 'lucide-react';
import { useViewPreference } from '@/hooks/use-view-preference';

interface Topic {
  id: string;
  title: string;
  slug: string;
  created_at: string;
  is_pinned?: boolean;
  is_locked?: boolean;
  has_solution?: boolean;
  view_count: number;
  reply_count: number;
  last_reply_at?: string;
  author: {
    username: string;
    avatar_url?: string;
  } | null;
  category: {
    name: string;
    slug: string;
    color: string;
  } | null;
}

interface CategoryTopicsListProps {
  topics: Topic[];
}

export function CategoryTopicsList({ topics }: CategoryTopicsListProps) {
  const [view, setView] = useViewPreference('card');

  return (
    <div className="space-y-4">
      {/* View Toggle */}
      <div className="flex justify-end">
        <ViewToggle view={view} onViewChange={setView} />
      </div>

      {/* Card View */}
      {view === 'card' && (
        <div className="space-y-2 sm:space-y-3">
          {topics.map((topic) => (
            <Card key={topic.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-3 sm:p-5">
                <div className="flex items-start justify-between gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 sm:mb-2 flex-wrap">
                      {topic.is_pinned && (
                        <Pin className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 flex-shrink-0" />
                      )}
                      {topic.is_locked && (
                        <span className="text-sm sm:text-base text-gray-400 dark:text-gray-500">🔒</span>
                      )}
                      {topic.has_solution && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
                          <CheckCircle className="w-3 h-3" />
                          Riješeno
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/forum/topic/${topic.slug}`}
                      className="text-base sm:text-xl font-semibold hover:text-blue-600 dark:hover:text-blue-400 transition-colors block line-clamp-2"
                    >
                      {topic.title}
                    </Link>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 sm:mt-2">
                      <span className="truncate max-w-[120px] sm:max-w-none">
                        od {topic.author?.username}
                      </span>
                      <span className="flex items-center gap-1 flex-shrink-0">
                        <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4" />
                        {topic.reply_count}
                      </span>
                      <span className="sm:hidden">
                        {Math.floor((Date.now() - new Date(topic.created_at).getTime()) / (1000 * 60 * 60)) < 24
                          ? `${Math.floor((Date.now() - new Date(topic.created_at).getTime()) / (1000 * 60 * 60))}h`
                          : `${Math.floor((Date.now() - new Date(topic.created_at).getTime()) / (1000 * 60 * 60 * 24))}d`}
                      </span>
                      <span className="hidden sm:inline">
                        {new Date(topic.created_at).toLocaleDateString('hr-HR')}
                      </span>
                      {topic.last_reply_at && (
                        <span className="hidden md:inline text-gray-400 dark:text-gray-500">
                          zadnji: {new Date(topic.last_reply_at).toLocaleDateString('hr-HR')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-center flex-shrink-0">
                    <div className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">{topic.view_count}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">pregleda</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Table View */}
      {view === 'table' && <TopicTable topics={topics} />}
    </div>
  );
}
