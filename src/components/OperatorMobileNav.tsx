import { useState, useEffect } from 'react';
import { X, Home, Monitor, Tag, Package, Store, HelpCircle, FileText, Bell, Settings, Sun, Moon, Laptop, User, LogOut, Sparkles, UtensilsCrossed } from 'lucide-react';

interface OperatorMobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: string;
  onNavigate: (view: string) => void;
  userName?: string;
  userRole?: string;
  locationName?: string;
  onBackToRoles?: () => void;
  notificationCount?: number;
}

type ThemeMode = 'light' | 'dark' | 'system' | 'wand';

export default function OperatorMobileNav({
  isOpen,
  onClose,
  currentView,
  onNavigate,
  userName = 'Store Operator',
  userRole = 'Operator',
  locationName,
  onBackToRoles,
  notificationCount = 0
}: OperatorMobileNavProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme-mode') as ThemeMode;
    if (savedTheme) {
      setThemeMode(savedTheme);
      applyTheme(savedTheme);
    } else {
      applyTheme('system');
    }
  }, []);

  const applyTheme = (mode: ThemeMode) => {
    const root = window.document.documentElement;
    let isDark = false;
    let themeColor = '#ffffff';

    // Remove all theme classes first
    root.classList.remove('dark', 'wand-theme');

    if (mode === 'wand') {
      root.classList.add('wand-theme');
      themeColor = '#000000';
    } else if (mode === 'system') {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      isDark = systemPrefersDark;
      if (systemPrefersDark) {
        root.classList.add('dark');
        themeColor = '#0f172a';
      }
    } else if (mode === 'dark') {
      isDark = true;
      root.classList.add('dark');
      themeColor = '#0f172a';
    }

    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', themeColor);
    }
  };

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    localStorage.setItem('theme-mode', mode);
    applyTheme(mode);

    window.dispatchEvent(new CustomEvent('theme-change', { detail: { theme: mode } }));
  };
  const navigationItems = [
    { id: 'displays', label: 'Operator Hub', icon: Home },
    { id: 'brands', label: 'Brands', icon: UtensilsCrossed },
    { id: 'signage', label: 'Digital Signage', icon: Monitor },
    { id: 'labels', label: 'Shelf Labels', icon: Tag },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'store', label: 'Store Configuration', icon: Store },
  ];

  const handleNavClick = (viewId: string) => {
    onNavigate(viewId);
    onClose();
  };

  const handleHelpClick = () => {
    // Placeholder for help functionality
    onClose();
  };

  const handleDocumentationClick = () => {
    // Placeholder for documentation functionality
    onClose();
  };

  const handleNotificationsClick = () => {
    // Placeholder for notifications functionality
    onClose();
  };

  const handleSwitchRole = () => {
    if (onBackToRoles) {
      onBackToRoles();
    }
    onClose();
  };

  const handleSettingsClick = () => {
    setShowSettings(!showSettings);
  };

  return (
    <>
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 z-[200] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <div
        className={`fixed top-0 left-0 h-full w-[85%] max-w-[320px] bg-white dark:bg-slate-800 shadow-2xl z-[201] transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-800">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">{userName}</h2>
              {locationName && (
                <p className="text-sm text-slate-600 dark:text-slate-400 truncate">{locationName}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0 ml-2"
              aria-label="Close navigation"
            >
              <X className="w-6 h-6 text-slate-600 dark:text-slate-400" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-2">
            {!showSettings ? (
              <>
                <div className="px-3 py-2">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-3 mb-2">
                    Navigation
                  </p>
                  <div className="space-y-1">
                    {navigationItems.map((item) => {
                      const isActive = currentView === item.id;
                      const Icon = item.icon;

                      return (
                        <button
                          key={item.id}
                          onClick={() => handleNavClick(item.id)}
                          className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all touch-manipulation ${
                            isActive
                              ? 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-900 dark:text-cyan-300 font-semibold border border-cyan-200 dark:border-cyan-700'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100 dark:active:bg-slate-600'
                          }`}
                          style={isActive ? { borderColor: '#00adf0', backgroundColor: 'rgba(0, 173, 240, 0.1)' } : undefined}
                        >
                          <Icon
                            className={`w-5 h-5 flex-shrink-0 ${
                              isActive ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-500'
                            }`}
                            style={isActive ? { color: '#00adf0' } : undefined}
                          />
                          <span className="text-base">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="px-3 py-2 mt-4">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-3 mb-2">
                    Resources
                  </p>
                  <div className="space-y-1">
                    <button
                      onClick={handleNotificationsClick}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all touch-manipulation text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100 dark:active:bg-slate-600"
                    >
                      <Bell className="w-5 h-5 flex-shrink-0 text-slate-400 dark:text-slate-500" />
                      <span className="text-base flex-1 text-left">Notifications</span>
                      {notificationCount > 0 && (
                        <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                          {notificationCount > 9 ? '9+' : notificationCount}
                        </span>
                      )}
                    </button>

                    <button
                      onClick={handleHelpClick}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all touch-manipulation text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100 dark:active:bg-slate-600"
                    >
                      <HelpCircle className="w-5 h-5 flex-shrink-0 text-slate-400 dark:text-slate-500" />
                      <span className="text-base">Help</span>
                    </button>

                    <button
                      onClick={handleDocumentationClick}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all touch-manipulation text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100 dark:active:bg-slate-600"
                    >
                      <FileText className="w-5 h-5 flex-shrink-0 text-slate-400 dark:text-slate-500" />
                      <span className="text-base">Documentation</span>
                    </button>

                    <button
                      onClick={handleSettingsClick}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all touch-manipulation text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100 dark:active:bg-slate-600"
                    >
                      <Settings className="w-5 h-5 flex-shrink-0 text-slate-400 dark:text-slate-500" />
                      <span className="text-base">Settings</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="px-3 py-2">
                <div className="flex items-center gap-2 px-3 mb-4">
                  <button
                    onClick={handleSettingsClick}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  </button>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Settings</h3>
                </div>

                <div className="space-y-6">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-3 mb-3">
                      Appearance
                    </p>
                    <div className="space-y-2 px-3">
                      <button
                        onClick={() => handleThemeChange('system')}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all touch-manipulation ${
                          themeMode === 'system'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-700 font-medium'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-transparent'
                        }`}
                      >
                        <Laptop className={`w-5 h-5 flex-shrink-0 ${themeMode === 'system' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
                        <div className="flex-1 text-left">
                          <div className="font-medium">System</div>
                          <div className={`text-xs ${themeMode === 'system' ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>Use device theme</div>
                        </div>
                        {themeMode === 'system' && (
                          <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full" />
                        )}
                      </button>

                      <button
                        onClick={() => handleThemeChange('light')}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all touch-manipulation ${
                          themeMode === 'light'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-700 font-medium'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-transparent'
                        }`}
                      >
                        <Sun className={`w-5 h-5 flex-shrink-0 ${themeMode === 'light' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
                        <div className="flex-1 text-left">
                          <div className="font-medium">Light</div>
                          <div className={`text-xs ${themeMode === 'light' ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>Always light theme</div>
                        </div>
                        {themeMode === 'light' && (
                          <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full" />
                        )}
                      </button>

                      <button
                        onClick={() => handleThemeChange('dark')}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all touch-manipulation ${
                          themeMode === 'dark'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-700 font-medium'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-transparent'
                        }`}
                      >
                        <Moon className={`w-5 h-5 flex-shrink-0 ${themeMode === 'dark' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
                        <div className="flex-1 text-left">
                          <div className="font-medium">Dark</div>
                          <div className={`text-xs ${themeMode === 'dark' ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>Always dark theme</div>
                        </div>
                        {themeMode === 'dark' && (
                          <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full" />
                        )}
                      </button>

                      <button
                        onClick={() => handleThemeChange('wand')}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all touch-manipulation ${
                          themeMode === 'wand'
                            ? 'bg-wand-magenta-100 text-wand-magenta-900 border border-wand-magenta-300 font-medium'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-transparent'
                        }`}
                      >
                        <Sparkles className={`w-5 h-5 flex-shrink-0 ${themeMode === 'wand' ? 'text-wand-magenta-600' : 'text-slate-400 dark:text-slate-500'}`} />
                        <div className="flex-1 text-left">
                          <div className="font-medium">Extra Dark Theme</div>
                          <div className={`text-xs ${themeMode === 'wand' ? 'text-wand-magenta-700' : 'text-slate-500 dark:text-slate-400'}`}>Vibrant brand colors</div>
                        </div>
                        {themeMode === 'wand' && (
                          <div className="w-2 h-2 bg-wand-magenta-600 rounded-full" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-3 mb-3">
                      Account
                    </p>
                    <div className="space-y-2 px-3">
                      <div className="flex items-center gap-3 px-3 py-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                        <User className="w-5 h-5 flex-shrink-0 text-slate-400 dark:text-slate-500" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{userName}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{userRole}</div>
                        </div>
                      </div>

                      {onBackToRoles && (
                        <button
                          onClick={handleSwitchRole}
                          className="w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all touch-manipulation text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                          <LogOut className="w-5 h-5 flex-shrink-0 text-slate-400 dark:text-slate-500" />
                          <span className="text-base">Switch Role</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </nav>

          {!showSettings && (
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
              <div className="text-xs text-slate-500 dark:text-slate-400 text-center">
                <p className="text-slate-400 dark:text-slate-500">WAND Digital Studio</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
