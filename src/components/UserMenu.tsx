import { useState } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import ThemeToggle from './ThemeToggle';

interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  role: string;
}

interface UserMenuProps {
  user: UserProfile;
}

export default function UserMenu({ user }: UserMenuProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const getInitials = (name: string) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase();
  };

  const handleClearCache = async () => {
    setIsClearing(true);

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        console.log('Cache cleared:', event.data);
        window.location.reload();
      };

      navigator.serviceWorker.controller.postMessage('CLEAR_CACHE', [messageChannel.port2]);
    } else {
      await caches.keys().then((names) => {
        return Promise.all(names.map((name) => caches.delete(name)));
      });
      window.location.reload();
    }
  };

  const displayName = user.display_name;

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        aria-expanded={showMenu}
        aria-label="Account menu"
        className="flex items-center gap-2 p-1 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
      >
        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-wand-magenta-500 text-white font-semibold text-sm">
          {getInitials(displayName)}
        </div>
        <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center bg-wand-magenta-500 text-white font-semibold text-lg">
                  {getInitials(displayName)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate">{displayName}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                </div>
              </div>
            </div>

            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Appearance</p>
              <ThemeToggle />
            </div>

            <div className="p-2">
              <Button
                variant="ghost"
                onClick={handleClearCache}
                disabled={isClearing}
                className="w-full justify-start"
              >
                <RefreshCw className={isClearing ? 'animate-spin' : ''} />
                {isClearing ? 'Clearing cache...' : 'Clear cache & reload'}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
