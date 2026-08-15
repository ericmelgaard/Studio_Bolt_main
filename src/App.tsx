import { useState, useEffect, lazy, Suspense } from 'react';
import { UserRole } from './lib/supabase';
import RoleSelection from './components/RoleSelection';
import AuthForm from './components/AuthForm';
import { useUser } from './hooks/useUser';

const CreatorDashboard = lazy(() => import('./pages/CreatorDashboard'));
const OperatorDashboard = lazy(() => import('./pages/OperatorDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const MagicLinkUpload = lazy(() => import('./pages/MagicLinkUpload'));

type ThemeMode = 'light' | 'dark' | 'system';

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-slate-600 dark:text-slate-400">Loading...</p>
      </div>
    </div>
  );
}

function App() {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const { user, loading } = useUser(selectedRole);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme-mode') as ThemeMode;
    const theme = savedTheme || 'system';
    applyTheme(theme);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = () => {
      const currentTheme = localStorage.getItem('theme-mode') as ThemeMode;
      if (currentTheme === 'system' || !currentTheme) {
        applyTheme('system');
      }
    };

    const handleThemeChange = (e: CustomEvent) => {
      applyTheme(e.detail.theme);
    };

    mediaQuery.addEventListener('change', handleMediaChange);
    window.addEventListener('theme-change', handleThemeChange as EventListener);

    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange);
      window.removeEventListener('theme-change', handleThemeChange as EventListener);
    };
  }, []);

  const applyTheme = (mode: ThemeMode) => {
    const root = window.document.documentElement;
    let isDark = false;

    if (mode === 'system') {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      isDark = systemPrefersDark;
      if (systemPrefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    } else if (mode === 'dark') {
      isDark = true;
      root.classList.add('dark');
    } else {
      isDark = false;
      root.classList.remove('dark');
    }

    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', isDark ? '#0f172a' : '#ffffff');
    }
  };

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setShowAuthForm(true);
  };

  const handleBack = () => {
    setSelectedRole(null);
    setShowAuthForm(false);
  };

  if (loading) {
    return <LoadingFallback />;
  }

  const uploadMatch = window.location.pathname.match(/^\/upload\/(.+)$/);
  if (uploadMatch) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <MagicLinkUpload token={uploadMatch[1]} />
      </Suspense>
    );
  }

  if (showAuthForm && !user && selectedRole) {
    return <AuthForm role={selectedRole} onBack={handleBack} />;
  }

  if (selectedRole === 'creator' && user) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <CreatorDashboard onBack={handleBack} user={user} />
      </Suspense>
    );
  }

  if (selectedRole === 'operator' && user) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <OperatorDashboard onBack={handleBack} user={user} />
      </Suspense>
    );
  }

  if (selectedRole === 'admin' && user) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <AdminDashboard onBack={handleBack} user={user} />
      </Suspense>
    );
  }

  return <RoleSelection onSelectRole={handleRoleSelect} />;
}

export default App;
