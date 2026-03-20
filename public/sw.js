// fetchハンドラ（iOS SafariでSWを確実にactivateするために必要）
self.addEventListener('fetch', () => {});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/sch-logo.png',
      badge: '/sch-logo.png',
      data: { url: data.url ?? '/sch' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/sch') && 'focus' in client) return client.focus();
      }
      return clients.openWindow(event.notification.data?.url ?? '/sch');
    })
  );
});
