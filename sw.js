/* CV Builder – offline support.
   The page itself: always checks GitHub for the newest version first (when online),
   and falls back to the saved copy when offline or on a very slow connection.
   Icons and other files: served from the saved copy, refreshed in the background. */
const VERSION = 'cvb-v2';
const FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');

  if (isPage) {
    // Newest version first; saved copy if offline or slower than 4 seconds.
    e.respondWith(caches.open(VERSION).then(cache => {
      const network = fetch(req, { cache: 'no-cache' }).then(res => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      });
      const saved = () => cache.match(req, { ignoreSearch: true }).then(h => h || cache.match('./index.html'));
      const timeout = new Promise(resolve => setTimeout(resolve, 4000)).then(saved);
      return Promise.race([network.catch(saved), timeout.then(h => h || network)])
        .then(res => res || network.catch(saved));
    }));
    return;
  }

  e.respondWith(caches.open(VERSION).then(cache =>
    cache.match(req, { ignoreSearch: true }).then(hit => {
      const fresh = fetch(req).then(res => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => hit);
      return hit || fresh;
    })
  ));
});
