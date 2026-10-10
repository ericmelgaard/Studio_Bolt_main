// Service Worker for PWA with automatic updates
const CACHE_VERSION = 'v5-20260204-1';
const BUILD_TIMESTAMP = '20260204-1';
const CACHE_NAME = `wand-operator-hub-${CACHE_VERSION}`;
const HTML_CACHE = `wand-html-${CACHE_VERSION}`;
const ASSETS_CACHE = `wand-assets-${CACHE_VERSION}`;

// Install event - cache critical assets and skip waiting immediately
self.addEventListener('install', (event) => {
  console.log('[SW] Installing new service worker:', CACHE_VERSION);
  event.waitUntil(
    caches.open(ASSETS_CACHE).then((cache) => {
      return cache.addAll([
        'manifest.json',
        'logo_32.png',
        'WandLogoNoText.png'
      ]);
    })
  );
  // Force immediate activation
  self.skipWaiting();
});

// Activate event - aggressively clean up ALL old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating new service worker:', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== HTML_CACHE && name !== ASSETS_CACHE && name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] All old caches cleared');
      // Force immediate control of all clients
      return self.clients.claim();
    })
  );
});

// Fetch event - network-first for HTML, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // NEVER cache Supabase API calls - always fetch fresh
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(request));
    return;
  }

  // Network-first strategy for HTML files (ensures updates are fetched)
  if (request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone and cache the fresh response
          const responseClone = response.clone();
          caches.open(HTML_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Fallback to cache if offline
          return caches.match(request);
        })
    );
    return;
  }

  // Cache-first strategy for static assets (CSS, JS, images)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        // Don't cache non-OK responses or non-GET requests
        if (!response || response.status !== 200 || request.method !== 'GET') {
          return response;
        }

        // Clone and cache the response
        const responseClone = response.clone();
        caches.open(ASSETS_CACHE).then((cache) => {
          cache.put(request, responseClone);
        });

        return response;
      });
    })
  );
});

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Handle cache clearing request
  if (event.data === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        console.log('[SW] Clearing all caches on request');
        return Promise.all(
          cacheNames.map((name) => caches.delete(name))
        );
      }).then(() => {
        console.log('[SW] All caches cleared');
        // Notify the client that cache is cleared
        event.ports[0].postMessage({ status: 'success', message: 'Cache cleared' });
      })
    );
  }

  // Return current version
  if (event.data === 'GET_VERSION') {
    event.ports[0].postMessage({
      version: CACHE_VERSION,
      buildTimestamp: BUILD_TIMESTAMP
    });
  }
});
