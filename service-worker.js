const CACHE_NAME = 'graphforge-core-v2';
const urlsToCache = [
  // App Shell
  '/',
  '/index.html',
  '/index.tsx',
  '/App.tsx',
  '/types.ts',
  '/lib/g3dParser.ts',
  '/components/ControlSuite.tsx',
  '/components/VisualizationCanvas.tsx',
  '/components/Scene.tsx',
  '/lib/svgExport.ts',
  '/vite.svg',
  '/manifest.json',
  '/metadata.json',
  
  // External Dependencies from CDN
  'https://cdn.tailwindcss.com'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // Use addAll with a single request object for CDN URLs to avoid cache-busting issues
        const requests = urlsToCache.map(url => new Request(url, { cache: 'reload' }));
        return cache.addAll(requests);
      })
      .catch(err => {
        console.error('Failed to cache resources on install:', err);
      })
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }
  
  const url = new URL(event.request.url);

  // For CDN assets, use a cache-first strategy.
  if (url.hostname === 'cdn.tailwindcss.com') {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          return response || fetch(event.request).then(networkResponse => {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
            return networkResponse;
          });
        })
    );
    return;
  }

  // Network-first for navigation to get the latest HTML, fallback to cache.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Cache-first for all other local assets.
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request).then(
          networkResponse => {
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                  cache.put(event.request, responseToCache);
              });
            return networkResponse;
          }
        );
      })
  );
});


self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});