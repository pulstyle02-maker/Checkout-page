const CACHE_NAME = 'modmedicalis-v1';
const urlsToCache = [
  './',
  './app.html',
  './manifest.json',
  'https://i.imgur.com/wliwntu.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : { title: 'ModMedicalis Update', body: 'Check your app for the latest updates.' };
  self.registration.showNotification(data.title || 'ModMedicalis', {
    body: data.body,
    icon: 'https://i.imgur.com/wliwntu.png',
    badge: 'https://i.imgur.com/wliwntu.png'
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow('./'));
});
