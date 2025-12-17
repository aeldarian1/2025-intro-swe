'use client';

import { LayoutGrid, LayoutList } from 'lucide-react';
import { Button } from './button';

interface ViewToggleProps {
  view: 'card' | 'table';
  onViewChange: (view: 'card' | 'table') => void;
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="hidden md:flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
      <Button
        variant={view === 'card' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('card')}
        className="h-8 px-3"
      >
        <LayoutGrid className="w-4 h-4 mr-1.5" />
        Kartice
      </Button>
      <Button
        variant={view === 'table' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('table')}
        className="h-8 px-3"
      >
        <LayoutList className="w-4 h-4 mr-1.5" />
        Tablica
      </Button>
    </div>
  );
}
