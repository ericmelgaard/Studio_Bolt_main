import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext';
import './index.css';

// Register service worker for PWA with aggressive auto-update
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' })
      .then((registration) => {
        console.log('[App] Service Worker registered');

        // Check for updates immediately on load
        registration.update();

        // Check for updates every 30 seconds (more aggressive)
        setInterval(() => {
          console.log('[App] Checking for Service Worker updates');
          registration.update();
        }, 30000);

        // Also check when the page becomes visible (user switches back to tab)
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) {
            console.log('[App] Page visible, checking for updates');
            registration.update();
          }
        });

        // Handle updates
        registration.addEventListener('updatefound', () => {
          console.log('[App] Update found, installing new Service Worker');
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[App] New Service Worker installed, activating immediately');
                // Auto-activate immediately
                newWorker.postMessage('SKIP_WAITING');
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('[App] Service Worker registration failed:', error);
      });

    // Reload when the new service worker takes control
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        console.log('[App] New Service Worker taking control, reloading');
        refreshing = true;
        window.location.reload();
      }
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);
