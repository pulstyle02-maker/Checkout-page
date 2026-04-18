const CACHE_NAME = 'modmedicalis-v2';
const STATIC_CACHE = 'modmedicalis-static-v2';
const DYNAMIC_CACHE = 'modmedicalis-dynamic-v2';

const STATIC_ASSETS = [
  './',
  './app.html',
  './manifest.json',
  'https://i.imgur.com/wliwntu.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;800;900&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys.filter(key => 
        key !== STATIC_CACHE && key !== DYNAMIC_CACHE && key !== CACHE_NAME
      ).map(key => caches.delete(key)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.hostname.includes('firebaseauth') || url.hostname.includes('firestore')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  if (url.hostname.includes('raw.githubusercontent.com')) {
    event.respondWith(
      caches.match(request).then(cached => {
        return cached || fetch(request).then(response => {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  if (request.destination === 'style' || request.destination === 'script' || request.destination === 'font' || request.destination === 'image') {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok && request.method === 'GET') {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : { 
    title: 'ModMedicalis Update', 
    body: 'Check your app for the latest updates.', 
    icon: 'https://i.imgur.com/wliwntu.png' 
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'ModMedicalis', {
      body: data.body || '',
      icon: data.icon || 'https://i.imgur.com/wliwntu.png',
      badge: data.badge || 'https://i.imgur.com/wliwntu.png',
      tag: data.tag || 'modmedicalis-notification',
      vibrate: [200, 100, 200],
      actions: [
        { action: 'open', title: 'Open App' },
        { action: 'dismiss', title: 'Dismiss' }
      ],
      requireInteraction: true
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(clientList => {
          if (clientList.length > 0) {
            return clientList[0].focus();
          }
          return clients.openWindow('./');
        })
    );
  }
});

self.addEventListener('sync', event => {
  if (event.tag === 'sync-login') {
    event.waitUntil(self.clients.matchAll().then(clients => {
      clients.forEach(client => client.postMessage({ type: 'LOGIN_RETRY' }));
    }));
  }
});
