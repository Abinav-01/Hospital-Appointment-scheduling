import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBpYMnbxIlTqNhraUroohv2EwLj2AlqwLg",
    authDomain: "hospital-scheduling-9f527.firebaseapp.com",
    projectId: "hospital-scheduling-9f527",
    storageBucket: "hospital-scheduling-9f527.firebasestorage.app",
    messagingSenderId: "321155840739",
    appId: "1:321155840739:web:681d2e9f4941db8ae2a3d6",
    measurementId: "G-HE0493E4BY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.useDeviceLanguage(); // Set language to user's device language
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', async function() {
    // Login form handler
    const loginForm = document.querySelector('#loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.querySelector('input[type="email"]').value;
            const password = document.querySelector('input[type="password"]').value;
            const errorDiv = document.getElementById('error-message');
            
            try {
                // Admin login check
                if (email.toLowerCase() === 'admin@hospital.com') {
                    if (password === 'admin123') {
                        const adminData = {
                            fullName: 'Admin',
                            email: 'admin@hospital.com',
                            role: 'admin',
                            isAdmin: true
                        };
                        sessionStorage.setItem('userData', JSON.stringify(adminData));
                        window.location.replace("admin-dashboard.html");
                        return;
                    }
                    errorDiv.textContent = "Invalid admin credentials";
                    return;
                }

                // Regular user authentication
                let userCredential;
                try {
                    userCredential = await signInWithEmailAndPassword(auth, email, password);
                } catch (signInError) {
                    console.error("signInWithEmailAndPassword error:", signInError.message);
                    errorDiv.textContent = "Invalid email or password.";
                    return;
                }
                
                const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
                
                if (!userDoc.exists()) {
                    errorDiv.textContent = "User data not found";
                    return;
                }

                const userData = {
                    ...userDoc.data(),
                    uid: userCredential.user.uid
                };
                
                // Store user data and ensure it's saved before redirect
                sessionStorage.setItem('userData', JSON.stringify(userData));

                // Use replace instead of href to prevent back navigation
                switch (userData.role) {
                    case 'doctor':
                        window.location.replace("doctor-dashboard.html");
                        break;
                    case 'patient':
                        window.location.replace("patient-dashboard.html");
                        break;
                    default:
                        console.error("Invalid user role:", userData.role);
                        errorDiv.textContent = "Invalid user role";
                }

            } catch (error) {
                console.error("Login error:", error);
                errorDiv.textContent = "An unexpected error occurred during login.";
            }
        });
    }

    // Updated Registration form handler
    const registrationForm = document.querySelector('form[id="registrationForm"]');
    if (registrationForm) {
        registrationForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const errorDiv = document.getElementById('register-error');
            
            // Get all form values
            const fullName = document.querySelector('#fullName').value;
            const email = document.querySelector('#registerEmail').value;
            const password = document.querySelector('#registerPassword').value;
            const confirmPassword = document.querySelector('#confirmPassword').value;
            const address = document.querySelector('#address').value;
            const dateOfBirth = document.querySelector('#dateOfBirth').value;
            const phoneNumber = document.querySelector('#phoneNumber').value;

            // Validate passwords match
            if (password !== confirmPassword) {
                errorDiv.textContent = "Passwords do not match!";
                return;
            }

            // Validate phone number
            if (!/^\d{10}$/.test(phoneNumber)) {
                errorDiv.textContent = "Please enter a valid 10-digit phone number";
                return;
            }

            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                
                // Store additional user data in Firestore
                await setDoc(doc(db, "users", userCredential.user.uid), {
                    fullName: fullName,
                    email: email,
                    role: 'patient',
                    address: address,
                    dateOfBirth: dateOfBirth,
                    phoneNumber: phoneNumber,
                    createdAt: new Date().toISOString()
                });

                alert('Registration successful! Please login.');
                window.location.href = 'login.html';
            } catch (error) {
                console.error("Registration error:", error);
                errorDiv.textContent = error.message;
            }
        });
    }

    // Updated Password reset handler
    const resetPasswordForm = document.querySelector('form[id="resetPasswordForm"]');
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.querySelector('#resetEmail').value;
            const errorDiv = document.getElementById('reset-error');
            const successDiv = document.getElementById('reset-success');
            const submitButton = this.querySelector('button[type="submit"]');

            try {
                submitButton.disabled = true; // Prevent multiple submissions
                await sendPasswordResetEmail(auth, email, {
                    url: window.location.origin + '/login.html', // Redirect URL after password reset
                    handleCodeInApp: false
                });
                
                errorDiv.textContent = '';
                successDiv.textContent = 'Password reset email sent! Please check your inbox.';
                successDiv.style.color = 'green';
                
                // Redirect after 3 seconds
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 3000);
            } catch (error) {
                submitButton.disabled = false;
                errorDiv.textContent = getErrorMessage(error.code);
                errorDiv.style.color = 'red';
                successDiv.textContent = '';
            }
        });
    }

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
                return 'An error occurred. Please try again later.';
        }
    }

    // Admin functions for managing doctors
    async function createDoctorAccount(doctorData) {
        try {
            // Create authentication for doctor
            const userCredential = await createUserWithEmailAndPassword(auth, doctorData.email, doctorData.password);
            
            // Store doctor data in Firestore
            await setDoc(doc(db, "users", userCredential.user.uid), {
                fullName: doctorData.fullName,
                email: doctorData.email,
                role: 'doctor',
                specialization: doctorData.specialization,
                createdBy: 'admin',
                createdAt: new Date().toISOString()
            });
            
            return { success: true, uid: userCredential.user.uid };
        } catch (error) {
            console.error("Error creating doctor account:", error);
            throw error;
        }
    }

});
