const CACHE_VERSION = 'smart-time-religious-v1';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const QURAN_CACHE = `${CACHE_VERSION}-quran`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const APP_SHELL = ['/religious', '/religious/muslim', '/religious/christian'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' }))).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('smart-time-religious-') && ![APP_SHELL_CACHE, QURAN_CACHE, STATIC_CACHE].includes(key))
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Quran JSON: cache-first so previously opened/downloaded surahs remain available offline.
  if (url.pathname.startsWith('/quran/') && url.pathname.toLowerCase().endsWith('.json')) {
    event.respondWith((async () => {
      const cache = await caches.open(QURAN_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return new Response(JSON.stringify({ error: 'offline', message: 'هذا الملف غير محفوظ على الجهاز بعد.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json; charset=utf-8' }
        });
      }
    })());
    return;
  }

  // Static same-origin resources: serve cached assets immediately when available.
  if (['script', 'style', 'image', 'font'].includes(request.destination)) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(request);
      const network = fetch(request).then((response) => {
        if (response.ok) cache.put(request, response.clone()).catch(() => undefined);
        return response;
      });
      return cached || network;
    })());
    return;
  }

  // SPA routes use network-first, with a cached route/root as an offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(APP_SHELL_CACHE);
          cache.put(request, response.clone()).catch(() => undefined);
        }
        return response;
      } catch {
        const cache = await caches.open(APP_SHELL_CACHE);
        return (await cache.match(request)) || (await cache.match('/religious')) || (await cache.match('/religious/muslim')) || Response.error();
      }
    })());
  }
});
