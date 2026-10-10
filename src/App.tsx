import { useEffect, lazy, Suspense } from 'react';
import { useUser } from './hooks/useUser';
import { applyTheme, getSavedTheme } from './lib/theme';

const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const MagicLinkUpload = lazy(() => import('./pages/MagicLinkUpload'));

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 dark:border-sky-400"></div>
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  );
}

function App() {
  const { user, loading } = useUser('admin');

  useEffect(() => {
    applyTheme(getSavedTheme());

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = () => {
      if (getSavedTheme() === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleMediaChange);
    return () => mediaQuery.removeEventListener('change', handleMediaChange);
  }, []);

  if (loading) {
    return <LoadingFallback />;
  }

  const appPath = window.location.pathname.slice(import.meta.env.BASE_URL.length - 1);
  const uploadMatch = appPath.match(/^\/upload\/(.+)$/);
  if (uploadMatch) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <MagicLinkUpload token={uploadMatch[1]} />
      </Suspense>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Couldn't load the admin profile. Check the Supabase settings in .env and reload.
        </p>
      </div>
    );
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      <AdminDashboard user={user} />
    </Suspense>
  );
}

export default App;
