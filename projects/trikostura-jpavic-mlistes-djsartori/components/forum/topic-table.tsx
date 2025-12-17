'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CheckCircle, MessageSquare, Eye, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { formatDistanceToNow } from '@/lib/utils';

interface Topic {
  id: string;
  title: string;
  slug: string;
  reply_count: number;
  view_count: number;
  created_at: string;
  has_solution?: boolean;
  is_pinned?: boolean;
  is_locked?: boolean;
  author: {
    username: string;
  } | null;
  category: {
    name: string;
    slug: string;
    color: string;
  } | null;
}

interface TopicTableProps {
  topics: Topic[];
}

type SortField = 'title' | 'author' | 'replies' | 'views' | 'date';
type SortDirection = 'asc' | 'desc';

export function TopicTable({ topics }: TopicTableProps) {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedTopics = [...topics].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
      case 'author':
        comparison = (a.author?.username || '').localeCompare(b.author?.username || '');
        break;
      case 'replies':
        comparison = a.reply_count - b.reply_count;
        break;
      case 'views':
        comparison = a.view_count - b.view_count;
        break;
      case 'date':
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-4 h-4 text-primary" />
    ) : (
      <ArrowDown className="w-4 h-4 text-primary" />
    );
  };

  return (
    <div className="hidden md:block overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
          <tr>
            <th className="text-left p-4 font-semibold text-gray-900 dark:text-white">
              <button
                onClick={() => handleSort('title')}
                className="flex items-center gap-2 hover:text-primary transition-colors"
              >
                Tema
                <SortIcon field="title" />
              </button>
            </th>
            <th className="text-left p-4 font-semibold text-gray-900 dark:text-white hidden lg:table-cell">
              <button
                onClick={() => handleSort('author')}
                className="flex items-center gap-2 hover:text-primary transition-colors"
              >
                Autor
                <SortIcon field="author" />
              </button>
            </th>
            <th className="text-center p-4 font-semibold text-gray-900 dark:text-white">
              <button
                onClick={() => handleSort('replies')}
                className="flex items-center gap-2 mx-auto hover:text-primary transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                <SortIcon field="replies" />
              </button>
            </th>
            <th className="text-center p-4 font-semibold text-gray-900 dark:text-white">
              <button
                onClick={() => handleSort('views')}
                className="flex items-center gap-2 mx-auto hover:text-primary transition-colors"
              >
                <Eye className="w-4 h-4" />
                <SortIcon field="views" />
              </button>
            </th>
            <th className="text-right p-4 font-semibold text-gray-900 dark:text-white">
              <button
                onClick={() => handleSort('date')}
                className="flex items-center gap-2 ml-auto hover:text-primary transition-colors"
              >
                Aktivnost
                <SortIcon field="date" />
              </button>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {sortedTopics.map((topic) => (
            <tr
              key={topic.id}
              className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <td className="p-4">
                <div className="space-y-1">
                  <Link
                    href={`/forum/topic/${topic.slug}`}
                    className="font-semibold text-gray-900 dark:text-white hover:text-primary transition-colors line-clamp-1 block"
                  >
                    {topic.is_pinned && '📌 '}
                    {topic.is_locked && '🔒 '}
                    {topic.title}
                  </Link>
                  <div className="flex items-center gap-2 text-xs">
                    {topic.category && (
                      <Link
                        href={`/forum/category/${topic.category.slug}`}
                        className="px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: topic.category.color + '20',
                          color: topic.category.color,
                        }}
                      >
                        {topic.category.name}
                      </Link>
                    )}
                    {topic.has_solution && (
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                        <CheckCircle className="w-3 h-3" />
                        Riješeno
                      </span>
                    )}
                  </div>
                </div>
              </td>
              <td className="p-4 hidden lg:table-cell">
                {topic.author?.username ? (
                  <Link
                    href={`/forum/user/${topic.author.username}`}
                    className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors"
                  >
                    @{topic.author.username}
                  </Link>
                ) : (
                  <span className="text-gray-600 dark:text-gray-400">
                    @nepoznato
                  </span>
                )}
              </td>
              <td className="p-4 text-center text-gray-900 dark:text-white font-semibold">
                {topic.reply_count}
              </td>
              <td className="p-4 text-center text-gray-600 dark:text-gray-400">
                {topic.view_count}
              </td>
              <td className="p-4 text-right text-sm text-gray-600 dark:text-gray-400">
                {formatDistanceToNow(new Date(topic.created_at))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
