import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

export const firebaseConfig = {
    apiKey: "AIzaSyBpYMnbxIlTqNhraUroohv2EwLj2AlqwLg",
    authDomain: "hospital-scheduling-9f527.firebaseapp.com",
    projectId: "hospital-scheduling-9f527",
    storageBucket: "hospital-scheduling-9f527.firebasestorage.app",
    messagingSenderId: "321155840739",
    appId: "1:321155840739:web:681d2e9f4941db8ae2a3d6",
    measurementId: "G-HE0493E4BY"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
