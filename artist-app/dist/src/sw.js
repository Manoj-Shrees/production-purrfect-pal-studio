// ─────────────────────────────────────────────────────────────────────────────
// src/sw.js  (place in your Angular project's /src folder)
//
// Custom service worker that receives Web Push notifications and shows them
// even when the Angular app tab is closed or in the background.
//
// Registration: see web-push.service.ts — it registers this file on init.
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener('install', () => {
  // Activate immediately — don't wait for old SW to be discarded
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // Take control of all open tabs straight away
  event.waitUntil(self.clients.claim());
});

// ── Receive push ──────────────────────────────────────────────────────────────
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
    icon:    '/assets/icons/icon-192x192.png',   // update path to your app icon
    badge:   '/assets/icons/badge-72x72.png',    // small monochrome badge icon
    tag:     payload.data?.event || 'pps-push',  // replaces previous notification of same tag
    renotify: true,
    data:    payload.data || {},
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const data    = event.notification.data || {};
  const orderID = data.orderID;

  // Try to focus an existing tab first; open a new one if none found.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // If there's already an open tab, focus it and post a message so
      // the Angular app can navigate to the relevant order.
      if (clients.length > 0) {
        const client = clients[0];
        client.postMessage({ type: 'PUSH_CLICK', data });
        return client.focus();
      }
      // No open tab — open the app at the order detail page if we have an ID.
      const url = orderID ? `/?order_id=${orderID}` : '/';
      return self.clients.openWindow(url);
    })
  );
});