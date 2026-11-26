const CACHE = 'sebakul-static-v4';
const SHELL = [
  '/offline.html',
  '/manifest.json',
  '/images/sebakul-logo.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-192x192.png',
  '/icons/icon-maskable-512x512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(SHELL.map(url => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then(keys =>
          Promise.all(
            keys
              .filter(key => key.startsWith('sebakul-static-') && key !== CACHE)
              .map(key => caches.delete(key))
          )
        ),
      self.clients.claim(),
    ])
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const path = new URL(request.url).pathname;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
    return;
  }

  // Stale-while-revalidate for static media/icons/brand images; never cache non-image or error responses
  if (
    path.startsWith('/_next/static/media/') ||
    path.startsWith('/icons/') ||
    path.startsWith('/images/')
  ) {
    event.respondWith(
      caches.open(CACHE).then(async cache => {
        const cached = await cache.match(request);
        const networkFetch = fetch(request)
          .then(response => {
            const contentType = response.headers.get('content-type') || '';
            if (response.ok && (contentType.startsWith('image/') || contentType.startsWith('font/'))) {
              void cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
  }
});
