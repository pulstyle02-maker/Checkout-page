// ================= MODMEDICALIS PWA SERVICE WORKER =================

// 1. IMPORT FIREBASE SDKS FOR BACKGROUND PUSH NOTIFICATIONS
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

// 2. INITIALIZE FIREBASE IN THE SERVICE WORKER
firebase.initializeApp({
  apiKey: "AIzaSyC5NkowybsLrQnTyuFrm2VTTHE2R2yNddA",
  authDomain: "modqbank.firebaseapp.com",
  projectId: "modqbank",
  storageBucket: "modqbank.firebasestorage.app",
  messagingSenderId: "44011667684",
  appId: "1:44011667684:web:89421cc40c8bb37e806cf1"
});

const messaging = firebase.messaging();

// 3. CACHE CONFIGURATION (Bumped to v5 to FORCE PURGE the broken cache on users' phones)
const STATIC_CACHE = 'modmedicalis-static-v5';
const DYNAMIC_CACHE = 'modmedicalis-dynamic-v5';

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
  'https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js',
  'https://fonts.googleapis.com/css8?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap'
];

// ================= CACHING ENGINE =================

// Install: Cache each asset individually so one failure does not abort the install
self.addEventListener('install', event => {
  self.skipWaiting(); // Force the waiting service worker to become the active service worker
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

// Activate: Clean up old caches (This deletes the broken v4 cache that was causing logouts)
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

  // 1. NEVER attempt to cache non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // =========================================================================
  // CRITICAL FIX: PREVENT GHOST LOGOUTS AND FIREBASE DATABASE DEADLOCKS
  // Absolutely NEVER intercept or cache Firebase Auth, Firestore, or Google APIs.
  // =========================================================================
  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('securetoken') ||
    url.hostname.includes('identitytoolkit')
  ) {
    return; // Let the request go directly to the network without Service Worker interference
  }

  // 2. Navigation Request: User opening the PWA on iPhone/Android
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
          // Guaranteed offline fallback so mobile devices NEVER show the dinosaur/black screen
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

// ================= FIREBASE BACKGROUND NOTIFICATION ENGINE =================

// This handles push messages received while the PWA is fully closed/backgrounded
messaging.onBackgroundMessage(function(payload) {
  console.log('[sw.js] Received background message ', payload);
  
  // Safely extract data whether it was sent as a 'notification' payload or 'data' payload
  const notificationTitle = payload.notification?.title || payload.data?.title || 'Blockify Alert';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.message || 'You have a new update.',
    icon: 'https://i.imgur.com/kZsZDzA.jpeg',
    badge: 'https://i.imgur.com/kZsZDzA.jpeg',
    vibrate: [200, 100, 200],
    data: payload.data || {},
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle clicking the notification when the app is closed
self.addEventListener('notificationclick', event => {
  event.notification.close();

  // If user clicked dismiss, do nothing
  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // If the app is already open in a tab, focus it
        for (const client of clientList) {
          if ('focus' in client) return client.focus();
        }
        // Otherwise, open a new window to the app
        return clients.openWindow('./');
      })
  );
});
