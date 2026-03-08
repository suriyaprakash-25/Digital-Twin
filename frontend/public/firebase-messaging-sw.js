/* eslint-disable no-restricted-globals */

// Generic Push handler (works for FCM webpush payloads as well)
self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = {};
  }

  const notification = payload.notification || payload.data || {};
  const title = notification.title || 'Mobility DT';
  const options = {
    body: notification.body || '',
    data: payload.data || {},
    icon: '/favicon.ico'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (allClients && allClients.length > 0) {
        allClients[0].focus();
        return;
      }
      await clients.openWindow('/');
    })()
  );
});
