importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

// 1. INITIALIZE FIREBASE
firebase.initializeApp({
    apiKey: "AIzaSyC5NkowybsLrQnTyuFrm2VTTHE2R2yNddA",
    authDomain: "modqbank.firebaseapp.com",
    projectId: "modqbank",
    storageBucket: "modqbank.firebasestorage.app",
    messagingSenderId: "44011667684",
    appId: "1:44011667684:web:89421cc40c8bb37e806cf1"
});

const messaging = firebase.messaging();

// 2. CACHE CONFIGURATION
const DYNAMIC_CACHE = 'blockify-dynamic-v6';

self.addEventListener('install', event => {
    self.skipWaiting(); // Force instant update installation
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== DYNAMIC_CACHE).map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// 3. FETCH ENGINE (NETWORK FIRST FOR AUTO-UPDATES!)
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET') return;

    // DO NOT intercept Firebase APIs (Prevents ghost logouts & deadlocks)
    if (url.hostname.includes('googleapis.com') || url.hostname.includes('firebaseio.com') || url.hostname.includes('gstatic.com')) {
        return;
    }

    // NETWORK FIRST STRATEGY for HTML (Always fetches latest GitHub Push instantly!)
    if (request.mode === 'navigate' || request.url.includes('index.html')) {
        event.respondWith(
            fetch(request).then(response => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
                }
                return response;
            }).catch(async () => {
                // Instantly load from cache if offline
                return await caches.match(request, { ignoreSearch: true }) || await caches.match('./index.html', { ignoreSearch: true });
            })
        );
        return;
    }

    // CACHE FIRST STRATEGY for raw MCQs, JSONs, Images, and CSS
    event.respondWith(
        caches.match(request, { ignoreSearch: true }).then(cached => {
            const fetchPromise = fetch(request).then(response => {
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
                }
                return response;
            }).catch(() => cached);
            
            return cached || fetchPromise;
        })
    );
});

// 4. NATIVE BACKGROUND PUSH NOTIFICATIONS
messaging.onBackgroundMessage(function(payload) {
    console.log('[SW] Background notification received: ', payload);

    const notificationTitle = payload.notification?.title || payload.data?.title || 'Blockify Update';
    const notificationOptions = {
        body: payload.notification?.body || payload.data?.message || 'You have a new alert.',
        icon: 'https://i.imgur.com/kZsZDzA.jpeg',
        badge: 'https://i.imgur.com/kZsZDzA.jpeg',
        vibrate: [200, 100, 200],
        data: { url: payload.data?.click_action || './' },
        actions: [{ action: 'open', title: 'Open App' }]
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Click action to open app from background
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            for (const client of clientList) {
                if ('focus' in client) return client.focus();
            }
            return clients.openWindow(event.notification.data.url || './');
        })
    );
});
