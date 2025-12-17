'use client';

import { useState, useEffect } from 'react';

type ViewType = 'card' | 'table';

const STORAGE_KEY = 'forum-view-preference';

export function useViewPreference(defaultView: ViewType = 'card'): [ViewType, (view: ViewType) => void] {
  const [view, setView] = useState<ViewType>(defaultView);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load preference from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'card' || stored === 'table') {
        setView(stored);
      }
    } catch (error) {
      // Silently fail if localStorage is not available
      console.warn('Failed to load view preference:', error);
    }
    setIsLoaded(true);
  }, []);

  // Save preference to localStorage when it changes
  const updateView = (newView: ViewType) => {
    setView(newView);
    try {
      localStorage.setItem(STORAGE_KEY, newView);
    } catch (error) {
      console.warn('Failed to save view preference:', error);
    }
  };

  return [view, updateView];
}
