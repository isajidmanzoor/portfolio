// Shows Job Center notifications on browsers that only allow them from a service worker
// (Android Chrome), and opens the Live Jobs page when one is tapped.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL('./#live', self.registration.scope).href;
  e.waitUntil((async () => {
    const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const tab = tabs.find((c) => c.url.startsWith(self.registration.scope));
    if (tab) { await tab.focus(); return tab.navigate(url).catch(() => {}); }
    return self.clients.openWindow(url);
  })());
});
