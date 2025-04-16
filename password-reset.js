import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { firebaseConfig } from './firebase/config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

document.getElementById('resetForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.querySelector('input[type="email"]').value;
    const messageDiv = document.getElementById('reset-message');
    const submitButton = e.target.querySelector('button[type="submit"]');
    
    try {
        submitButton.disabled = true;
        messageDiv.textContent = 'Sending reset link...';

        // Simplified actionCodeSettings without handleCodeInApp
        await sendPasswordResetEmail(auth, email);

        messageDiv.style.color = '#28a745';
        messageDiv.textContent = 'Password reset link sent! Check your email.';
        
        // Redirect after 3 seconds
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 3000);
    } catch (error) {
        console.error('Error:', error);
        messageDiv.style.color = '#dc3545';
        messageDiv.textContent = getErrorMessage(error.code);
        submitButton.disabled = false;
    }
});

// Helper function to get user-friendly error messages
function getErrorMessage(errorCode) {
    switch (errorCode) {
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/user-not-found':
            return 'No account exists with this email address.';
        case 'auth/too-many-requests':
            return 'Too many attempts. Please try again later.';
        default:
            return 'Error sending reset link. Please try again.';
    }
}
