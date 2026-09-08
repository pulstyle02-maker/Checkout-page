importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker
firebase.initializeApp({
    apiKey: "AIzaSyC5NkowybsLrQnTyuFrm2VTTHE2R2yNddA",
    authDomain: "modqbank.firebaseapp.com",
    projectId: "modqbank",
    storageBucket: "modqbank.firebasestorage.app",
    messagingSenderId: "44011667684",
    appId: "1:44011667684:web:89421cc40c8bb37e806cf1"
});

const messaging = firebase.messaging();

// Background message handler
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: 'https://i.imgur.com/kZsZDzA.jpeg',
    badge: 'https://i.imgur.com/kZsZDzA.jpeg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
