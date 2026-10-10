import { useState } from 'react';
import { Laptop, Moon, Sun } from 'lucide-react';

import { cn } from '@/lib/utils';
import { getSavedTheme, setTheme, type ThemeMode } from '@/lib/theme';

const OPTIONS: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: 'system', label: 'System', icon: Laptop },
  { mode: 'light', label: 'Light', icon: Sun },
  { mode: 'dark', label: 'Dark', icon: Moon },
];

export default function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(getSavedTheme);

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className="grid grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-900"
    >
      {OPTIONS.map(({ mode: option, label, icon: Icon }) => {
        const selected = mode === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              setMode(option);
              setTheme(option);
            }}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500',
              selected
                ? 'bg-white text-sky-600 shadow-sm dark:bg-gray-700 dark:text-sky-400'
                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
