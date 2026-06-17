// PostJadual Service Worker v3
// Handles: caching, push notifications dari OneSignal
const CACHE = 'postjadual-v3';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(['/index.html', '/manifest.json']).catch(()=>{}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Don't cache OneSignal or external requests
  if (!e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

// OneSignal handles push events automatically via their SDK
// This SW just needs to exist for PWA to work
// The notificationclick below handles tap → open app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const data = e.notification.data || {};
  const url  = data.url || data.launchURL || '/';

  e.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) { client.focus(); return; }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

