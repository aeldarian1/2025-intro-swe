'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Keyboard } from 'lucide-react';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';

interface ShortcutConfig {
  key: string;
  description: string;
  action: () => void;
}

export function KeyboardShortcuts() {
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Show shortcuts modal
      if (e.key === '?') {
        e.preventDefault();
        setShowModal(true);
        return;
      }

      // Hide modal with Escape
      if (e.key === 'Escape' && showModal) {
        setShowModal(false);
        return;
      }

      // Navigation shortcuts
      switch (e.key.toLowerCase()) {
        case '/':
          e.preventDefault();
          router.push('/forum/search');
          break;
        case 'n':
        case '1':
          e.preventDefault();
          router.push('/forum/new');
          break;
        case 'h':
        case '2':
          e.preventDefault();
          router.push('/forum');
          break;
        case 'u':
        case '3':
          e.preventDefault();
          router.push('/forum/users');
          break;
        case 'l':
        case '4':
          e.preventDefault();
          router.push('/forum/leaderboard');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showModal, router]);

  const shortcuts: ShortcutConfig[] = [
    { key: '?', description: 'Prikaži tipkovničke prečace', action: () => setShowModal(true) },
    { key: '/', description: 'Pretraži forum', action: () => router.push('/forum/search') },
    { key: '1', description: 'Nova tema', action: () => router.push('/forum/new') },
    { key: '2', description: 'Početna stranica foruma', action: () => router.push('/forum') },
    { key: '3', description: 'Korisnici', action: () => router.push('/forum/users') },
    { key: '4', description: 'Ljestvica', action: () => router.push('/forum/leaderboard') },
    { key: 'Esc', description: 'Zatvori modal/dijalog', action: () => {} },
  ];

  if (!showModal) {
    return (
      <button
        onClick={() => setShowModal(true)}
        className="hidden lg:flex fixed bottom-6 right-6 items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg shadow-lg hover:shadow-xl transition-all hover:scale-105 z-40"
        title="Tipkovnički prečaci (?)"
        aria-label="Prikaži tipkovničke prečace"
      >
        <Keyboard className="w-4 h-4" />
        <span className="text-sm font-medium">?</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-primary" />
            Tipkovnički prečaci
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowModal(false)}
            className="h-8 w-8"
          >
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Koristi tipkovničke prečace za brže navigiranje po forumu
          </p>
          <div className="space-y-3">
            {shortcuts.map((shortcut, index) => (
              <button
                key={index}
                onClick={() => {
                  if (shortcut.key !== 'Esc' && shortcut.key !== '?') {
                    shortcut.action();
                    setShowModal(false);
                  }
                }}
                disabled={shortcut.key === 'Esc' || shortcut.key === '?'}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-50 disabled:dark:hover:bg-gray-800"
              >
                <span className="text-sm text-gray-900 dark:text-white text-left">
                  {shortcut.description}
                </span>
                <kbd className="px-3 py-1.5 text-sm font-semibold text-gray-900 dark:text-white bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded shadow-sm font-mono">
                  {shortcut.key}
                </kbd>
              </button>
            ))}
          </div>
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              💡 <strong>Savjet:</strong> Prečaci ne rade dok tipkaš u polju za unos teksta
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
