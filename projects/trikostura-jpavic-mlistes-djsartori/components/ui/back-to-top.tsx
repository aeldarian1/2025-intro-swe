"use client";

import { useEffect, useState } from 'react';
import { ChevronUp } from 'lucide-react';
import { Button } from './button';

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 400);
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Natrag na vrh"
      className="fixed bottom-6 right-4 sm:right-6 rounded-full shadow-lg bg-white/90 dark:bg-gray-900/90 border border-gray-200 dark:border-gray-700 hover:-translate-y-0.5 transition-transform"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <ChevronUp className="w-5 h-5" />
    </Button>
  );
}
