import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, query, where } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Initialize Firebase
const app = initializeApp({
    apiKey: "AIzaSyBpYMnbxIlTqNhraUroohv2EwLj2AlqwLg",
    authDomain: "hospital-scheduling-9f527.firebaseapp.com",
    projectId: "hospital-scheduling-9f527",
    storageBucket: "hospital-scheduling-9f527.firebasestorage.app",
    messagingSenderId: "321155840739",
    appId: "1:321155840739:web:681d2e9f4941db8ae2a3d6",
    measurementId: "G-HE0493E4BY"
});

const auth = getAuth(app);
const db = getFirestore(app);

// Add these global functions
globalThis.logout = () => {
    if (confirm('Are you sure you want to logout?')) {
        sessionStorage.removeItem('userData');
        window.location.href = 'login.html';
    }
};

globalThis.openEditDoctorModal = (docId) => {
    const doctor = currentDoctors.find(d => d.id === docId);
    if (doctor) {
        document.getElementById('editDoctorId').value = docId;
        document.getElementById('editDoctorName').value = doctor.fullName;
        document.getElementById('editDoctorEmail').value = doctor.email;
        document.getElementById('editDoctorSpecialization').value = doctor.specialization;
        document.getElementById('editDoctorModal').style.display = 'block';
    }
};

globalThis.closeEditDoctorModal = () => {
    document.getElementById('editDoctorModal').style.display = 'none';
    document.getElementById('editDoctorForm').reset();
};

// Add this at the top level of the file
let currentDoctors = [];

// Make functions globally available
globalThis.openAddDoctorModal = () => {
    document.getElementById('addDoctorModal').style.display = 'block';
};

globalThis.closeAddDoctorModal = () => {
    document.getElementById('addDoctorModal').style.display = 'none';
    document.getElementById('addDoctorForm').reset();
};

globalThis.deleteDoctor = async (docId) => {
    if (confirm('Are you sure you want to delete this doctor?')) {
        try {
            await deleteDoc(doc(db, "users", docId));
            loadDoctors();
            alert('Doctor deleted successfully!');
        } catch (error) {
            console.error("Error deleting doctor:", error);
            alert('Error deleting doctor: ' + error.message);
        }
    }
};

globalThis.deletePatient = async (docId) => {
    if (confirm('Are you sure you want to delete this patient?')) {
        try {
            await deleteDoc(doc(db, "users", docId));
            loadPatients();
            alert('Patient deleted successfully!');
        } catch (error) {
            console.error("Error deleting patient:", error);
            alert('Error deleting patient: ' + error.message);
        }
    }
};

async function loadDoctors() {
    const tbody = document.querySelector("#doctorsTable tbody");
    const loadingDiv = document.getElementById('doctorsLoading');
    const errorDiv = document.getElementById('doctorsError');

    try {
        // Show loading state
        loadingDiv.style.display = 'block';
        errorDiv.style.display = 'none';
        tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';

        const doctorsQuery = query(collection(db, "users"), where("role", "==", "doctor"));
        const querySnapshot = await getDocs(doctorsQuery);
        currentDoctors = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Clear loading message
        loadingDiv.style.display = 'none';
        
        // Update table content
        let tableContent = '';
        if (querySnapshot.empty) {
            tableContent = '<tr><td colspan="5" style="text-align: center;">No doctors found</td></tr>';
        } else {
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                tableContent += `
                    <tr>
                        <td>${data.fullName || 'N/A'}</td>
                        <td>${data.email || 'N/A'}</td>
                        <td class="password-cell">${data.password || 'N/A'}</td>
                        <td>${data.specialization || 'N/A'}</td>
                        <td>
                            <button class="btn btn-edit" onclick="openEditDoctorModal('${doc.id}')">Edit</button>
                            <button class="btn btn-delete" onclick="deleteDoctor('${doc.id}')">Delete</button>
                        </td>
                    </tr>
                `;
            });
        }
        tbody.innerHTML = tableContent;
        console.log('Doctors loaded successfully:', querySnapshot.size);
    } catch (error) {
        console.error('Error loading doctors:', error);
        errorDiv.textContent = 'Error loading doctors: ' + error.message;
        errorDiv.style.display = 'block';
        loadingDiv.style.display = 'none';
    }
}

async function loadPatients() {
    const tbody = document.querySelector("#patientsTable tbody");
    const loadingDiv = document.getElementById('patientsLoading');
    const errorDiv = document.getElementById('patientsError');

    try {
        loadingDiv.style.display = 'block';
        tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';

        const patientsQuery = query(collection(db, "users"), where("role", "==", "patient"));
        const querySnapshot = await getDocs(patientsQuery);
        
        let tableContent = '';
        if (querySnapshot.empty) {
            tableContent = '<tr><td colspan="4">No patients found</td></tr>';
        } else {
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                tableContent += `
                    <tr>
                        <td>${data.fullName || 'N/A'}</td>
                        <td>${data.email || 'N/A'}</td>
                        <td>${data.phoneNumber || 'N/A'}</td>
                        <td>
                            <button class="btn btn-delete" onclick="deletePatient('${doc.id}')">Delete</button>
                        </td>
                    </tr>
                `;
            });
        }
        tbody.innerHTML = tableContent;
        console.log('Patients loaded:', querySnapshot.size);
    } catch (error) {
        console.error('Error loading patients:', error);
        errorDiv.textContent = 'Error loading patients: ' + error.message;
        errorDiv.style.display = 'block';
        tbody.innerHTML = '<tr><td colspan="4">Error loading patients</td></tr>';
    } finally {
        loadingDiv.style.display = 'none';
    }
}

// Load data immediately
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing...');
    
    // Ensure tables are visible
    document.querySelectorAll('.section').forEach(section => {
        section.style.display = 'block';
    });
    
    // Load data
    Promise.all([loadDoctors(), loadPatients()])
        .then(() => {
            console.log('All data loaded successfully');
        })
        .catch(error => {
            console.error('Error loading data:', error);
        });
    
    // Set up form handler
    const addDoctorForm = document.getElementById('addDoctorForm');
    if (addDoctorForm) {
        addDoctorForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const submitButton = event.target.querySelector('button[type="submit"]');
            submitButton.disabled = true;

            try {
                const name = document.getElementById('doctorName').value;
                const email = document.getElementById('doctorEmail').value;
                const password = document.getElementById('doctorPassword').value;
                const specialization = document.getElementById('doctorSpecialization').value;

                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await setDoc(doc(db, "users", userCredential.user.uid), {
                    fullName: name,
                    email: email,
                    password: password, // Store password securely
                    role: 'doctor',
                    specialization: specialization,
                    createdAt: new Date().toISOString()
                });

                closeAddDoctorModal();
                await loadDoctors();
                alert('Doctor added successfully!');
            } catch (error) {
                console.error('Error adding doctor:', error);
                alert('Error adding doctor: ' + error.message);
            } finally {
                submitButton.disabled = false;
            }
        });
    }

    const editDoctorForm = document.getElementById('editDoctorForm');
    if (editDoctorForm) {
        editDoctorForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const docId = document.getElementById('editDoctorId').value;
            const updatedData = {
                fullName: document.getElementById('editDoctorName').value,
                email: document.getElementById('editDoctorEmail').value,
                specialization: document.getElementById('editDoctorSpecialization').value,
                updatedAt: new Date().toISOString()
            };

            try {
                await setDoc(doc(db, "users", docId), updatedData, { merge: true });
                closeEditDoctorModal();
                await loadDoctors();
                alert('Doctor updated successfully!');
            } catch (error) {
                console.error('Error updating doctor:', error);
                alert('Error updating doctor: ' + error.message);
            }
        });
    }
});
