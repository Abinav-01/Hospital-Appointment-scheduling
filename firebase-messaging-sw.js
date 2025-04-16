importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
    // Your firebaseConfig
    apiKey: "AIzaSyBpYMnbxIlTqNhraUroohv2EwLj2AlqwLg",
    authDomain: "hospital-scheduling-9f527.firebaseapp.com",
    projectId: "hospital-scheduling-9f527",
    storageBucket: "hospital-scheduling-9f527.firebasestorage.app",
    messagingSenderId: "321155840739",
    appId: "1:321155840739:web:681d2e9f4941db8ae2a3d6"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/icon.png' // Add your icon path
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});
