const CACHE_NAME = 'courtdraw-v5';
const STATIC_ASSETS = [
  '/manifest.json',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Network-first for HTML pages — ensures users always get the latest code.
  // Falls back to cache only when completely offline.
  const isNavigation = req.mode === 'navigate'
    || url.pathname.endsWith('.html')
    || url.pathname === '/';

  if (isNavigation && req.method === 'GET') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first for all other assets (icons, manifest, fonts, etc.)
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req))
  );
});
