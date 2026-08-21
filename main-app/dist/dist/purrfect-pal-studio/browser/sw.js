// ─────────────────────────────────────────────────────────────────────────────
// src/sw.js (Service Worker for client website)
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', event => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Purrfect Pal Studio', body: event.data.text(), data: {} };
  }

  const title   = payload.title || 'Purrfect Pal Studio';
  const options = {
    body:    payload.body  || '',
    icon:    '/assets/images/pps-logo.png',
    badge:   '/assets/images/pps-logo.png',
    tag:     payload.data?.event || 'pps-client-push',
    renotify: true,
    data:    payload.data || {},
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const data    = event.notification.data || {};
  const orderID = data.orderID;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      if (clients.length > 0) {
        const client = clients[0];
        client.postMessage({ type: 'PUSH_CLICK', data });
        return client.focus();
      }
      const url = orderID ? `/OrderTracking?order_id=${orderID}` : '/';
      return self.clients.openWindow(url);
    })
  );
});
