const CACHE_NAME = 'courtdraw-v9';
const STATIC_ASSETS = [
  '/manifest.json',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png'
];

// Assets that must always be fetched fresh from the network.
// tactics-library.js is excluded from static cache so updates
// (new tactics added) are never blocked by a stale cached copy.
const NETWORK_FIRST_PATTERNS = [
  '/tactics-library.js'
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

  if (req.method !== 'GET') return;

  // Network-first for HTML pages and tactics-library.js —
  // ensures users always get the latest content.
  // Falls back to cache only when completely offline.
  const isNavigation = req.mode === 'navigate'
    || url.pathname.endsWith('.html')
    || url.pathname === '/';

  const isNetworkFirst = isNavigation
    || NETWORK_FIRST_PATTERNS.some(p => url.pathname === p);

  if (isNetworkFirst) {
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
