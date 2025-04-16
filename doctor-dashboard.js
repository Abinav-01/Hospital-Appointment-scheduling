import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    collection, 
    query, 
    where, 
    getDocs, 
    addDoc, 
    updateDoc,
    orderBy 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { firebaseConfig } from './firebase/config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentDoctor = null;

document.addEventListener('DOMContentLoaded', async () => {

    const userData = JSON.parse(sessionStorage.getItem('userData'));
    if (!userData || userData.role !== 'doctor') {
        window.location.href = 'login.html';
        return;
    }

    currentDoctor = userData;
    await loadDoctorInfo();
    setupNavigationHandlers();
    await loadTodayAppointments();
    await loadAvailability();
});

async function loadDoctorInfo() {
    if (currentDoctor) {
        document.getElementById('doctorName').textContent = `Dr. ${currentDoctor.fullName}`;
        document.getElementById('doctorSpecialization').textContent = currentDoctor.specialization;
    }
}

async function loadTodayAppointments() {
    const tbody = document.getElementById('todayAppointments');
    if (!tbody) return;

    try {
        const today = new Date().toISOString().split('T')[0];
        const appointmentsQuery = query(
            collection(db, 'appointments'),
            where('doctorId', '==', currentDoctor.uid),
            where('date', '==', today)
        );

        const snapshot = await getDocs(appointmentsQuery);
        let appointmentsHTML = `
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Patient Name</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
        `;

        if (snapshot.empty) {
            appointmentsHTML += '<tr><td colspan="4">No appointments for today</td></tr>';
        } else {
            let hasAppointments = false;
            for (const appointmentDoc of snapshot.docs) {
                const appointment = appointmentDoc.data();
                const appointmentDateTime = new Date(`${appointment.date}T${appointment.time}`);
                const now = new Date();
                const isPastAppointment = appointmentDateTime < now;
                if (appointment.status !== 'completed') {
                    hasAppointments = true;
                    const patientDoc = await getDoc(doc(db, 'users', appointment.patientId));
                    const patient = patientDoc.data();

                    let actionsHTML;
                    if (isPastAppointment) {
                        if (!appointment.reportAdded) {
                            actionsHTML = `<button class="btn-report" onclick="openReportModal('${appointmentDoc.id}', '${appointment.patientId}', false)">
                                        Add Report
                                    </button>`;
                        } else {
                            actionsHTML = `<button class="btn-view-report" onclick="openReportModal('${appointmentDoc.id}', '${appointment.patientId}', true)">
                                        View Report
                                    </button>`;
                        }
                    } else {
                        actionsHTML = `<button class="btn-report" onclick="openReportModal('${appointmentDoc.id}', '${appointment.patientId}', false)">
                                    Add Report
                                </button>`;
                    }

                    appointmentsHTML += `
                        <tr>
                            <td>${appointment.time}</td>
                            <td>${patient.fullName}</td>
                            <td>${appointment.status}</td>
                            <td>
                                ${actionsHTML}
                            </td>
                        </tr>
                    `;
                }
            }
            if (!hasAppointments) {
                appointmentsHTML = `
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Patient Name</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td colspan="4">No appointments for today</td></tr>
                    </tbody>
                `;
            }
        }
        appointmentsHTML += '</tbody>';
        tbody.innerHTML = appointmentsHTML;
    } catch (error) {
        console.error('Error loading today\'s appointments:', error);
        tbody.innerHTML = '<tr><td colspan="4">Error loading appointments</td></tr>';
    }
}

function setupNavigationHandlers() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.currentTarget.getAttribute('onclick')) return;
            e.preventDefault();
            const sectionId = e.currentTarget.getAttribute('data-section');
            showSection(sectionId);
        });
    });
}

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');

    switch(sectionId) {
        case 'appointments':
            loadAppointments();
            break;
        case 'patients':
            loadPatientRecords();
            break;
        case 'availability':
            loadAvailability();
            break;
        case 'notifications':
            loadNotifications();
            break;
        case 'profile':
            loadProfile();
            break;
    }
}

window.openDiagnosisModal = (appointmentId, patientId) => {
    document.getElementById('appointmentId').value = appointmentId;
    document.getElementById('patientId').value = patientId;
    document.getElementById('diagnosisModal').style.display = 'block';
};

window.closeDiagnosisModal = () => {
    document.getElementById('diagnosisModal').style.display = 'none';
    document.getElementById('diagnosisForm').reset();
};

document.getElementById('diagnosisForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const appointmentId = document.getElementById('appointmentId').value;
    const patientId = document.getElementById('patientId').value;
    
    const diagnosisData = {
        height: document.getElementById('height').value,
        weight: document.getElementById('weight').value,
        problems: document.getElementById('problems').value,
        diagnosis: document.getElementById('diagnosis').value,
        prescription: document.getElementById('prescription').value,
        doctorId: currentDoctor.uid,
        doctorName: currentDoctor.fullName,
        date: new Date().toISOString(),
        appointmentId: appointmentId
    };

    try {
        await addDoc(collection(db, `patients/${patientId}/medical-records`), diagnosisData);
        
        await updateDoc(doc(db, 'appointments', appointmentId), {
            status: 'completed',
            diagnosisAdded: true
        });

        alert('Diagnosis saved successfully!');
        closeDiagnosisModal();
        loadAppointments();
    } catch (error) {
        console.error('Error saving diagnosis:', error);
        alert('Error saving diagnosis');
    }
});

window.openReportModal = async (appointmentId, patientId, viewOnly) => {
    document.getElementById('appointmentId').value = appointmentId;
    document.getElementById('patientId').value = patientId;

    const reportModal = document.getElementById('reportModal');
    const reportForm = document.getElementById('reportForm');
    const reportDisplay = document.getElementById('reportDisplay');

    reportForm.style.display = 'none';
    reportDisplay.style.display = 'none';

    if (viewOnly) {
        try {
            const reportsQuery = query(
                collection(db, `patients/${patientId}/medical-records`),
                where('appointmentId', '==', appointmentId)
            );
            const snapshot = await getDocs(reportsQuery);
            if (snapshot.empty) {
                alert('No report found for this appointment.');
                return;
            }

            const report = snapshot.docs[0].data();

            reportDisplay.innerHTML = `
                <p><strong>Height:</strong> ${report.height} cm</p>
                <p><strong>Weight:</strong> ${report.weight} kg</p>
                <p><strong>Diagnosis:</strong> ${report.diagnosis}</p>
                <p><strong>Prescription:</strong> ${report.prescription}</p>
                <p><strong>Doctor:</strong> ${report.doctorName}</p>
                <p><strong>Date:</strong> ${new Date(report.date).toLocaleDateString()}</p>
            `;
            reportDisplay.style.display = 'block';
        } catch (error) {
            console.error('Error fetching report:', error);
            alert('Error fetching report. Please try again.');
            return;
        }
    } else {
        reportForm.style.display = 'block';
    }

    reportModal.style.display = 'block';
};

window.closeReportModal = () => {
    document.getElementById('reportModal').style.display = 'none';
    document.getElementById('reportForm').reset();
};

document.getElementById('reportForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const appointmentId = document.getElementById('appointmentId').value;
    const patientId = document.getElementById('patientId').value;

    const reportData = {
        height: document.getElementById('patientHeight').value,
        weight: document.getElementById('patientWeight').value,
        diagnosis: document.getElementById('patientDiagnosis').value,
        prescription: document.getElementById('patientPrescription').value,
        doctorId: currentDoctor.uid,
        doctorName: currentDoctor.fullName,
        date: new Date().toISOString(),
        appointmentId: appointmentId
    };

    try {
        const recordId = doc(collection(db, `patients/${patientId}/medical-records`)).id;

        await setDoc(doc(db, `patients/${patientId}/medical-records`, recordId), reportData);

        await updateDoc(doc(db, 'appointments', appointmentId), {
            status: 'completed',
            reportAdded: true
        });

        alert('Report saved successfully!');
        closeReportModal();
        loadTodayAppointments();
    } catch (error) {
        console.error('Error saving report:', error);
        alert('Error saving report');
    }
});

window.logout = () => {
    if (confirm('Are you sure you want to logout?')) {
        sessionStorage.removeItem('userData');
        window.location.href = 'login.html';
    }
};

async function loadAppointments() {
    const appointmentsTable = document.getElementById('appointmentsTable');
    try {
        const dates = [];
        for(let i = 0; i < 3; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            dates.push(date.toISOString().split('T')[0]);
        }

        const appointmentsQuery = query(
            collection(db, 'appointments'),
            where('doctorId', '==', currentDoctor.uid),
            where('date', 'in', dates)
        );

        const snapshot = await getDocs(appointmentsQuery);
        
        let upcomingHTML = `
            <table class="appointments-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Patient Name</th>
                        <th>Contact</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        let completedHTML = `
            <h2>Completed Appointments</h2>
            <table class="appointments-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Patient Name</th>
                        <th>Contact</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        if (snapshot.empty) {
            upcomingHTML += '<tr><td colspan="6">No upcoming appointments scheduled</td></tr>';
            completedHTML += '<tr><td colspan="6">No completed appointments scheduled</td></tr>';
        } else {
            for (const appointmentDoc of snapshot.docs) {
                const appointment = appointmentDoc.data();
                const patientRef = doc(db, 'users', appointment.patientId);
                const patientDoc = await getDoc(patientRef);
                const patientData = patientDoc.data();

                const formattedDate = new Date(appointment.date).toLocaleDateString();
                const appointmentDateTime = new Date(`${appointment.date}T${appointment.time}`);
                const now = new Date();
                const isPastAppointment = appointmentDateTime < now;

                let actionsHTML;
                if (isPastAppointment) {
                    if (!appointment.reportAdded) {
                        actionsHTML = `<button class="btn-report" onclick="openReportModal('${appointmentDoc.id}', '${appointment.patientId}', false)">
                                    Add Report
                                </button>`;
                    } else {
                        actionsHTML = `<button class="btn-view-report" onclick="openReportModal('${appointmentDoc.id}', '${appointment.patientId}', true)">
                                    View Report
                                </button>`;
                    }
                } else {
                    actionsHTML = `Not Available`;
                }

                const appointmentRow = `
                    <tr>
                        <td>${formattedDate}</td>
                        <td>${appointment.time}</td>
                        <td>${patientData.fullName}</td>
                        <td>${patientData.phoneNumber || 'N/A'}</td>
                        <td>${appointment.status}</td>
                        <td>
                            ${actionsHTML}
                        </td>
                    </tr>
                `;

                if (appointment.status === 'completed') {
                    completedHTML += appointmentRow;
                } else if (isPastAppointment) {
                    completedHTML += appointmentRow;
                } else {
                    upcomingHTML += appointmentRow;
                }
            }
        }

        upcomingHTML += '</tbody></table>';
        completedHTML += '</tbody></table>';
        appointmentsTable.innerHTML = upcomingHTML + completedHTML;

    } catch (error) {
        console.error('Error loading appointments:', error);
        appointmentsTable.innerHTML = '<p>Error loading appointments</p>';
    }
}

async function loadPatientRecords() {
    const searchInput = document.getElementById('patientSearch');
    const patientsTableDiv = document.getElementById('patientsRecordsContainer');

    searchInput.addEventListener('input', debounce(async (e) => {
        const searchTerm = e.target.value.toLowerCase();
        await searchAndDisplayPatients(searchTerm);
    }, 300));

    await searchAndDisplayPatients('');
}

async function searchAndDisplayPatients(searchTerm) {
    const patientsTableDiv = document.getElementById('patientsRecordsContainer');
    try {
        const patientsQuery = query(collection(db, "users"), where("role", "==", "patient"));
        const querySnapshot = await getDocs(patientsQuery);
        
        let patientsHTML = '';
        
        for (const doc of querySnapshot.docs) {
            const patient = doc.data();
            
            if (searchTerm && !patient.fullName.toLowerCase().includes(searchTerm) && 
                !patient.email.toLowerCase().includes(searchTerm)) {
                continue;
            }

            const recordsQuery = query(collection(db, `patients/${doc.id}/medical-records`));
            const recordsSnapshot = await getDocs(recordsQuery);
            const records = recordsSnapshot.docs.map(record => ({
                id: record.id,
                ...record.data()
            }));

            patientsHTML += `
                <div class="patient-record">
                    <div class="patient-info">
                        <h3>${patient.fullName}</h3>
                        <p>Email: ${patient.email}</p>
                        <p>Phone: ${patient.phoneNumber || 'N/A'}</p>
                        <p>DOB: ${patient.dateOfBirth || 'N/A'}</p>
                    </div>
                    <div class="medical-records">
                        <h4>Medical Records</h4>
                        <table class="medical-records-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Time</th>
                                    <th>Doctor</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${records.map(record => `
                                    <tr>
                                        <td>${new Date(record.date).toLocaleDateString()}</td>
                                        <td>${new Date(record.date).toLocaleTimeString()}</td>
                                        <td>${record.doctorName}</td>
                                        <td>
                                            <button class="btn-view-report" onclick="openMedicalRecordModal('${doc.id}', '${record.id}')">View Report</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        patientsTableDiv.innerHTML = patientsHTML || '<p>No patients found</p>';
    } catch (error) {
        console.error('Error loading patient records:', error);
        patientsTableDiv.innerHTML = '<p>Error loading patient records</p>';
    }
}

window.openMedicalRecordModal = async (patientId, recordId) => {
    try {
        const recordDoc = await getDoc(doc(db, `patients/${patientId}/medical-records`, recordId));
        if (!recordDoc.exists()) {
            alert('Medical record not found.');
            return;
        }

        const record = recordDoc.data();
        const modalContent = `
            <p><strong>Height:</strong> ${record.height} cm</p>
            <p><strong>Weight:</strong> ${record.weight} kg</p>
            <p><strong>Problems:</strong> ${record.problems || 'N/A'}</p>
            <p><strong>Diagnosis:</strong> ${record.diagnosis}</p>
            <p><strong>Prescription:</strong> ${record.prescription}</p>
            <p><strong>Doctor:</strong> ${record.doctorName}</p>
            <p><strong>Date:</strong> ${new Date(record.date).toLocaleDateString()}</p>
        `;

        document.getElementById('medicalRecordDetails').innerHTML = modalContent;
        document.getElementById('medicalRecordModal').style.display = 'block';
    } catch (error) {
        console.error('Error fetching medical record:', error);
        alert('Error fetching medical record. Please try again.');
    }
};

window.closeMedicalRecordModal = () => {
    document.getElementById('medicalRecordModal').style.display = 'none';
};

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function loadAvailability() {
    const dateSlots = document.querySelector('.date-slots');
    const dates = [];
    const daysHTML = [];

    for(let i = 0; i < 3; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const dateString = date.toISOString().split('T')[0];
        dates.push(dateString);

        const availabilityDoc = await getDoc(doc(db, 'doctorAvailability', `${currentDoctor.uid}_${dateString}`));
        const availability = availabilityDoc.exists() ? availabilityDoc.data() : {
            available: false,
            morningSessions: [{startTime: '09:00', endTime: '13:00'}],
            eveningSessions: [{startTime: '14:00', endTime: '17:00'}],
            slotDuration: 30
        };

        if (availability.slotDuration && i === 0) {
            document.getElementById('slotDuration').value = availability.slotDuration;
        }

        const morningSession = availability.morningSessions && availability.morningSessions[0] ? 
            availability.morningSessions[0] : { startTime: '09:00', endTime: '13:00' };
        const eveningSession = availability.eveningSessions && availability.eveningSessions[0] ? 
            availability.eveningSessions[0] : { startTime: '14:00', endTime: '17:00' };

        daysHTML.push(`
            <div class="date-card" data-date="${dateString}">
                <div class="date-header">
                    <h3>${date.toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    })}</h3>
                </div>
                <div class="time-input-group">
                    <div class="form-group">
                        <label class="time-label">Morning Session</label>
                        <div class="time-inputs">
                            <input type="time" class="start-time" value="${morningSession.startTime}"
                                ${!availability.available ? 'disabled' : ''}> to
                            <input type="time" class="end-time" value="${morningSession.endTime}"
                                ${!availability.available ? 'disabled' : ''}>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="time-label">Evening Session</label>
                        <div class="time-inputs">
                            <input type="time" class="start-time" value="${eveningSession.startTime}"
                                ${!availability.available ? 'disabled' : ''}> to
                            <input type="time" class="end-time" value="${eveningSession.endTime}"
                                ${!availability.available ? 'disabled' : ''}>
                        </div>
                    </div>
                </div>
                <button type="button" class="availability-toggle ${availability.available ? 'available' : ''}" 
                    onclick="toggleDayAvailability(this, '${dateString}')">
                    ${availability.available ? 'Available' : 'Not Available'}
                </button>
            </div>
        `);
    }

    dateSlots.innerHTML = daysHTML.join('');

    const form = document.getElementById('availabilityForm');
    if (form) {
        form.onsubmit = saveAvailability;
    }
}

window.toggleDayAvailability = (button, date) => {
    const card = button.closest('.date-card');
    const isCurrentlyAvailable = button.classList.contains('available');
    const timeInputs = card.querySelectorAll('input[type="time"]');
    
    button.classList.toggle('available');
    timeInputs.forEach(input => input.disabled = isCurrentlyAvailable);
    button.textContent = isCurrentlyAvailable ? 'Not Available' : 'Available';
};

async function saveAvailability(e) {
    e.preventDefault();
    const slotDuration = parseInt(document.getElementById('slotDuration').value);
    const dateCards = document.querySelectorAll('.date-card');
    
    try {
        let savingPromises = [];

        for (const card of dateCards) {
            const date = card.dataset.date;
            const available = card.querySelector('.availability-toggle').classList.contains('available');
            const timeGroups = card.querySelectorAll('.time-inputs');
            
            const morningSessions = [{
                startTime: timeGroups[0].querySelector('.start-time').value,
                endTime: timeGroups[0].querySelector('.end-time').value
            }];

            const eveningSessions = [{
                startTime: timeGroups[1].querySelector('.start-time').value,
                endTime: timeGroups[1].querySelector('.end-time').value
            }];

            const availabilityData = {
                doctorId: currentDoctor.uid,
                date: date,
                available: available,
                morningSessions: morningSessions,
                eveningSessions: eveningSessions,
                slotDuration: slotDuration,
                updatedAt: new Date().toISOString()
            };

            savingPromises.push(
                setDoc(doc(db, 'doctorAvailability', `${currentDoctor.uid}_${date}`), availabilityData)
            );
        }

        await Promise.all(savingPromises);
        alert('Schedule saved successfully!');

    } catch (error) {
        console.error('Error saving schedule:', error);
        alert('Error saving schedule. Please try again.');
    }
}

async function loadNotifications() {
    const container = document.querySelector('.notifications-container');
    try {
        const notificationsQuery = query(
            collection(db, 'notifications'),
            where('doctorId', '==', currentDoctor.uid),
            orderBy('timestamp', 'desc')
        );

        const snapshot = await getDocs(notificationsQuery);
        let notificationsHTML = '';

        if (snapshot.empty) {
            notificationsHTML = '<p class="no-notifications">No notifications yet</p>';
        } else {
            for (const notificationDoc of snapshot.docs) {
                const notification = notificationDoc.data();
                const timeAgo = getTimeAgo(notification.timestamp);
                
                notificationsHTML += `
                    <div class="notification-item ${notification.read ? '' : 'unread'}" data-id="${notificationDoc.id}">
                        <span class="notification-time">${timeAgo}</span>
                        <div class="notification-content">
                            <div class="notification-title">${notification.type === 'booking' ? 'New Appointment' : 'Appointment Cancelled'}</div>
                            <div class="notification-details">
                                Patient <strong>${notification.patientName}</strong> has ${notification.type === 'booking' ? 'booked' : 'cancelled'} 
                                an appointment for ${formatDate(notification.appointmentDate)} at ${notification.appointmentTime}
                            </div>
                        </div>
                    </div>
                `;

                if (!notification.read) {
                    await updateDoc(doc(db, 'notifications', notificationDoc.id), {
                        read: true
                    });
                }
            }
        }

        container.innerHTML = notificationsHTML;
    } catch (error) {
        console.error('Error loading notifications:', error);
        container.innerHTML = '<p class="error">Error loading notifications</p>';
    }
}

function getTimeAgo(timestamp) {
    const now = new Date();
    const notificationDate = new Date(timestamp);
    const diffInSeconds = Math.floor((now - notificationDate) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return notificationDate.toLocaleDateString();
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

async function loadProfile() {
    try {
        const doctorDoc = await getDoc(doc(db, 'users', currentDoctor.uid));
        if (!doctorDoc.exists()) {
            throw new Error('Doctor profile not found');
        }

        const data = doctorDoc.data();
        
        const avatarText = document.querySelector('.avatar-text');
        avatarText.textContent = data.fullName.charAt(0).toUpperCase();

        document.getElementById('fullName').value = data.fullName || '';
        document.getElementById('email').value = data.email || '';
        document.getElementById('specialization').value = data.specialization || '';
        document.getElementById('phoneNumber').value = data.phoneNumber || '';
        document.getElementById('experience').value = data.experience || '';
        document.getElementById('qualifications').value = data.qualifications || '';
        document.getElementById('bio').value = data.bio || '';

    } catch (error) {
        console.error('Error loading profile:', error);
        alert('Error loading profile data');
    }
}

document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitButton = e.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
        const updatedData = {
            fullName: document.getElementById('fullName').value,
            specialization: document.getElementById('specialization').value,
            phoneNumber: document.getElementById('phoneNumber').value,
            experience: document.getElementById('experience').value,
            qualifications: document.getElementById('qualifications').value,
            bio: document.getElementById('bio').value,
            updatedAt: new Date().toISOString()
        };

        await updateDoc(doc(db, 'users', currentDoctor.uid), updatedData);
        
        const updatedDoctor = { ...currentDoctor, ...updatedData };
        sessionStorage.setItem('userData', JSON.stringify(updatedDoctor));
        currentDoctor = updatedDoctor;

        document.getElementById('doctorName').textContent = `Dr. ${updatedData.fullName}`;
        document.getElementById('doctorSpecialization').textContent = updatedData.specialization;

        alert('Profile updated successfully!');
    } catch (error) {
        console.error('Error updating profile:', error);
        alert('Error updating profile');
    } finally {
        submitButton.disabled = false;
    }
});

window.viewReport = async (appointmentId, patientId) => {
    try {
        const reportsQuery = query(
            collection(db, `patients/${patientId}/medical-records`),
            where('appointmentId', '==', appointmentId)
        );
        const snapshot = await getDocs(reportsQuery);
        if (snapshot.empty) {
            alert('No report found for this appointment.');
            return;
        }

        const report = snapshot.docs[0].data();
        const reportData = JSON.stringify(report).replace(/"/g, '&quot;');

        alert(`
            Medical Report:
            Height: ${report.height} cm
            Weight: ${report.weight} kg
            Diagnosis: ${report.diagnosis}
            Prescription: ${report.prescription}
            Doctor: ${report.doctorName}
            Date: ${new Date(report.date).toLocaleDateString()}
        `);
    } catch (error) {
        console.error('Error fetching report:', error);
        alert('Error fetching report. Please try again.');
    }
};
