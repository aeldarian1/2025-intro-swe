'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Search, Plus, User, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  isLoggedIn: boolean;
  unreadCount?: number;
}

export function BottomNav({ isLoggedIn, unreadCount = 0 }: BottomNavProps) {
  const pathname = usePathname();

  const navItems = [
    { href: '/forum', icon: Home, label: 'Forum', show: true },
    { href: '/forum/search', icon: Search, label: 'Pretraži', show: true },
    { href: '/forum/new', icon: Plus, label: 'Nova tema', show: isLoggedIn },
    { href: '/notifications', icon: Bell, label: 'Obavijesti', show: isLoggedIn, badge: unreadCount },
    { href: '/forum/user/me', icon: User, label: 'Profil', show: isLoggedIn },
  ].filter(item => item.show);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shadow-lg">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors relative',
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              )}
            >
              <div className="relative">
                <Icon className="w-6 h-6" />
                {item.badge && item.badge > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium">{item.label}</span>
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-blue-600 dark:bg-blue-400 rounded-b-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
