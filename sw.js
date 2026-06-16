const CACHE = 'postjadual-v2';
const ASSETS = ['/index.html', '/manifest.json'];

// ===== INSTALL =====
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS).catch(()=>{}))
  );
  self.skipWaiting();
});

// ===== ACTIVATE =====
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ===== FETCH =====
self.addEventListener('fetch', e => {
  // Only cache same-origin GET requests
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

// ===== SCHEDULED NOTIFICATIONS =====
// Store pending timers
const pendingTimers = {};

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE_NOTIF') {
    const payload = e.data.payload;
    const now = Date.now();
    const delay = payload.fireAt - now;

    // Cancel existing timer for this post if any
    if (pendingTimers[payload.id]) {
      clearTimeout(pendingTimers[payload.id]);
    }

    if (delay <= 0) return; // already past
    if (delay > 30 * 24 * 60 * 60 * 1000) return; // too far

    pendingTimers[payload.id] = setTimeout(() => {
      showScheduledNotification(payload);
      delete pendingTimers[payload.id];
    }, delay);
  }

  if (e.data && e.data.type === 'CANCEL_NOTIF') {
    if (pendingTimers[e.data.id]) {
      clearTimeout(pendingTimers[e.data.id]);
      delete pendingTimers[e.data.id];
    }
  }
});

function showScheduledNotification(payload) {
  const grpStr = payload.groupNames && payload.groupNames.length
    ? payload.groupNames.join(', ') + (payload.groupCount > 2 ? ' +' + (payload.groupCount - 2) + ' lagi' : '')
    : payload.groupCount + ' kumpulan';

  self.registration.showNotification('📅 Masa Posting Hampir Tiba!', {
    body: payload.title + '\n⏰ ' + payload.time + ' — ' + grpStr,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'post-' + payload.id,
    renotify: true,
    requireInteraction: true,   // <-- Kekal di notification tray sampai di-tap
    silent: false,
    data: { postId: payload.id, url: '/' }
  });
}

// ===== NOTIFICATION CLICK =====
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const postId = e.notification.data && e.notification.data.postId;
  const targetUrl = '/';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // If app already open, focus it
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if (postId) client.postMessage({ type: 'OPEN_POST', postId });
          return;
        }
      }
      // Otherwise open new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl + '?openPost=' + postId);
      }
    })
  );
});

// ===== PUSH (for future server-side push) =====
self.addEventListener('push', e => {
  if (!e.data) return;
  try {
    const data = e.data.json();
    e.waitUntil(
      self.registration.showNotification(data.title || '📅 PostJadual', {
        body: data.body || '',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        requireInteraction: true,
        tag: data.tag || 'postjadual',
        data: data
      })
    );
  } catch(err) {
    console.error('Push error', err);
  }
});
