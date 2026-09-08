// ================= MODMEDICALIS PWA SERVICE WORKER =================
const STATIC_CACHE = 'modmedicalis-static-v4';
const DYNAMIC_CACHE = 'modmedicalis-dynamic-v4';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://i.imgur.com/kZsZDzA.jpeg',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth-compat.js',
  'https://fonts.googleapis.com/css8?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap'
];

// Install: Cache each asset individually so one failure does not abort the install
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return Promise.all(
        STATIC_ASSETS.map(url => {
          return fetch(url, { mode: 'no-cors' })
            .then(response => cache.put(url, response))
            .catch(err => console.warn('Skipped caching for:', url, err));
        })
      );
    })
  );
});

// Activate: Clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
            .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Engine
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. NEVER attempt to cache non-GET requests (prevents Firestore POST crash)
  if (request.method !== 'GET') {
    return;
  }

  // 2. Navigation Request: User opening the PWA on iPhone (Online or Offline)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          // Guaranteed offline fallback so Safari NEVER shows the black screen
          const cached = await caches.match(request, { ignoreSearch: true }) ||
                         await caches.match('./', { ignoreSearch: true }) ||
                         await caches.match('./index.html', { ignoreSearch: true });
          return cached;
        })
    );
    return;
  }

  // 3. GitHub Content (Syllabus & MCQs): Cache-first with ignoreSearch to bypass ?nocache= timestamps
  if (url.hostname.includes('raw.githubusercontent.com')) {
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then(cached => {
        const fetchPromise = fetch(request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
          }
          return networkResponse;
        }).catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // 4. Styles, Scripts, Fonts, and Images
  if (request.destination === 'style' || request.destination === 'script' || request.destination === 'font' || request.destination === 'image') {
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then(cached => {
        return cached || fetch(request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // 5. Default Stale-While-Revalidate Fallback
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(cached => {
      const fetchPromise = fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});

// Push Notifications
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : { 
    title: 'Blockify Update', 
    body: 'Check your app for latest updates.', 
    icon: 'https://i.imgur.com/kZsZDzA.jpeg' 
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Blockify', {
      body: data.body || '',
      icon: data.icon || 'https://i.imgur.com/kZsZDzA.jpeg',
      badge: data.badge || 'https://i.imgur.com/kZsZDzA.jpeg',
      tag: data.tag || 'blockify-notification',
      vibrate: [200, 100, 200],
      actions: [
        { action: 'open', title: 'Open App' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if ('focus' in client) return client.focus();
        }
        return clients.openWindow('./');
      })
  );
});
