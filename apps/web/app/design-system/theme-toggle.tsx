'use client';

import { useEffect, useState } from 'react';
import { readPreference, writePreference } from './browser-preferences';

type Theme = 'dark' | 'light';
const STORAGE_KEY = 'media-runtime-theme';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('theme');
    const saved = readPreference('localStorage', STORAGE_KEY);
    const initial: Theme =
      requested === 'light' || requested === 'dark'
        ? requested
        : saved === 'light' || saved === 'dark'
          ? saved
          : window.matchMedia('(prefers-color-scheme: light)').matches
            ? 'light'
            : 'dark';
    document.documentElement.dataset.theme = initial;
    setTheme(initial);
  }, []);
  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    writePreference('localStorage', STORAGE_KEY, next);
    setTheme(next);
  };
  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggle}
      aria-label={`切換為${theme === 'dark' ? '明亮' : '暗色'}主題`}
    >
      {theme === 'dark' ? '☀ 明亮主題' : '☾ 暗色主題'}
    </button>
  );
}
