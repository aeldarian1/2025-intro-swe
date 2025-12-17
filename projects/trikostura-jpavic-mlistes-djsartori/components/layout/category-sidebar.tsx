'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { ChevronRight, Folder } from 'lucide-react';
import { useState } from 'react';

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  description?: string;
  topic_count?: number;
}

interface CategorySidebarProps {
  categories: Category[];
}

export function CategorySidebar({ categories }: CategorySidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Check if we're on a category page
  const isOnCategory = (slug: string) => pathname?.includes(`/category/${slug}`);

  return (
    <aside className="hidden lg:block lg:w-64 xl:w-72 flex-shrink-0">
      <div className="sticky top-20 space-y-4">
        {/* Categories Card */}
        <Card className="border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary/5 to-primary/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Folder className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-gray-900 dark:text-white">Kategorije</h3>
              </div>
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                aria-label={isCollapsed ? 'Proširi' : 'Smanji'}
              >
                <ChevronRight
                  className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                />
              </button>
            </div>
          </div>

          {!isCollapsed && (
            <nav className="p-2">
              {categories.map((category) => {
                const isActive = isOnCategory(category.slug);

                return (
                  <Link
                    key={category.id}
                    href={`/forum/category/${category.slug}`}
                    className={`
                      group flex items-start gap-3 p-3 rounded-lg transition-all
                      ${isActive
                        ? 'bg-primary/10 dark:bg-primary/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                      }
                    `}
                  >
                    <div
                      className="text-2xl flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0 transition-transform group-hover:scale-110"
                      style={{ backgroundColor: category.color + '20' }}
                    >
                      {category.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`
                          font-semibold text-sm truncate
                          ${isActive
                            ? 'text-primary'
                            : 'text-gray-900 dark:text-white group-hover:text-primary'
                          }
                        `}>
                          {category.name}
                        </span>
                        {category.topic_count !== undefined && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                            {category.topic_count}
                          </span>
                        )}
                      </div>
                      {category.description && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 mt-0.5">
                          {category.description}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </nav>
          )}
        </Card>

        {/* Quick Actions Card */}
        <Card className="border-gray-200 dark:border-gray-700 p-4">
          <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-3">
            Brze akcije
          </h4>
          <div className="space-y-2">
            <Link
              href="/forum"
              className="block text-sm text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
            >
              → Sve teme
            </Link>
            <Link
              href="/forum/search"
              className="block text-sm text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
            >
              → Pretraga
            </Link>
            <Link
              href="/forum/leaderboard"
              className="block text-sm text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
            >
              → Ljestvica
            </Link>
            <Link
              href="/forum/users"
              className="block text-sm text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
            >
              → Korisnici
            </Link>
          </div>
        </Card>
      </div>
    </aside>
  );
}
