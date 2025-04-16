import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, orderBy, deleteDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getMessaging, getToken } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js';
import { firebaseConfig } from './firebase/config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentPatient = null;

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

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const userData = JSON.parse(sessionStorage.getItem('userData'));
        
        if (!userData || !userData.uid) {
            console.log('No user data found, redirecting to login');
            window.location.href = 'login.html';
            return;
        }

        const userDoc = await getDoc(doc(db, 'users', userData.uid));
        
        if (!userDoc.exists()) {
            console.log('User document not found in Firestore');
            sessionStorage.removeItem('userData');
            window.location.href = 'login.html';
            return;
        }

        const userDocData = userDoc.data();
        if (userDocData.role !== 'patient') {
            console.log('User is not a patient');
            sessionStorage.removeItem('userData');
            window.location.href = 'login.html';
            return;
        }

        currentPatient = {
            ...userData,
            ...userDocData
        };
        loadPatientInfo();
        setupNavigationHandlers();
        await setupAvailabilityChangeListener();
        const messaging = getMessaging(app);
        
        if (Notification.permission === 'granted') {
            await requestAndSaveFCMToken(messaging);
        } else if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                await requestAndSaveFCMToken(messaging);
            } else {
                console.log('Notification permission was denied');
            }
        }

    } catch (error) {
        console.error('Dashboard initialization error:', error);
        sessionStorage.removeItem('userData');
        window.location.href = 'login.html';
    }
});
async function requestAndSaveFCMToken(messaging) {
    try {
        const token = await getToken(messaging, {
            vapidKey: 'BIZIfmDj4Bnd3vOgWF1IOIsqtzbWSFkMtIg8Bbk6dPDlU8-0XF03v3H7atTaC0mOtw6AvCr5SaN_r2HTyE5POlM' // Replace with your VAPID key
        });
        
        if (token) {
            await updateDoc(doc(db, 'users', currentPatient.uid), {
                fcmToken: token,
                notificationsEnabled: true,
                lastTokenUpdate: new Date().toISOString()
            });
            console.log('FCM Token saved successfully');
        }
    } catch (error) {
        console.error('Error saving FCM token:', error);
    }
}

window.requestNotificationPermission = async () => {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const messaging = getMessaging(app);
            await requestAndSaveFCMToken(messaging);
            alert('Notifications enabled successfully!');
        } else {
            alert('Please enable notifications to receive appointment reminders');
        }
    } catch (error) {
        console.error('Error requesting notification permission:', error);
        alert('Error enabling notifications. Please try again.');
    }
};

function loadPatientInfo() {
    document.getElementById('patientName').textContent = currentPatient.fullName;
    document.getElementById('welcomeName').textContent = currentPatient.fullName;
}

function setupNavigationHandlers() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.currentTarget.getAttribute('onclick')) return;
            e.preventDefault();
            const sectionId = e.currentTarget.getAttribute('data-section');
            if (sectionId) {
                showSection(sectionId);
            }
        });
    });
}
window.showSection = function(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');

    switch(sectionId) {
        case 'dashboard':
            loadDashboardContent();
            break;
        case 'book':
            loadBookingSection();
            break;
        case 'appointments':
            loadAppointments();
            break;
        case 'doctors':
            loadDoctors();
            break;
        case 'notifications':
            loadNotifications();
            break;
        case 'profile':
            loadProfile();
            break;
    }
};
function loadDashboardContent() {
    console.log('Loading dashboard content...');
}

window.logout = () => {
    if (confirm('Are you sure you want to logout?')) {
        sessionStorage.removeItem('userData');
        window.location.href = 'login.html';
    }
};

async function loadBookingSection() {
    const searchInput = document.getElementById('doctorSearch');
    await loadDoctors();
    
    searchInput.addEventListener('input', debounce(async (e) => {
        const searchTerm = e.target.value;
        await loadDoctors(searchTerm);
    }, 300));
}

async function loadDoctors(searchTerm = '') {
    const isBookingSection = document.getElementById('book').classList.contains('active');
    const container = isBookingSection ? 
        document.querySelector('.doctors-booking-grid') : 
        document.querySelector('#doctors .doctors-grid');

    try {
        const doctorsQuery = query(collection(db, "users"), where("role", "==", "doctor"));
        const snapshot = await getDocs(doctorsQuery);
        
        const doctors = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        const filteredDoctors = searchTerm ? 
            doctors.filter(doctor => {
                const searchTermLower = searchTerm.toLowerCase();
                return (
                    doctor.fullName?.toLowerCase().includes(searchTermLower) ||
                    doctor.specialization?.toLowerCase().includes(searchTermLower) ||
                    doctor.qualifications?.toLowerCase().includes(searchTermLower) ||
                    doctor.bio?.toLowerCase().includes(searchTermLower)
                );
            }) : doctors;

        if (filteredDoctors.length === 0) {
            container.innerHTML = '<p class="no-results">No doctors found matching your search.</p>';
            return;
        }
        filteredDoctors.sort((a, b) => a.fullName.localeCompare(b.fullName));

        // Render doctors based on section
        if (isBookingSection) {
            const doctorsHTML = filteredDoctors.map(doctor => `
                <div class="doctor-booking-card">
                    <div class="doctor-avatar">${doctor.fullName.charAt(0)}</div>
                    <h3>Dr. ${doctor.fullName}</h3>
                    <p>${doctor.specialization || 'General Physician'}</p>
                    <p>${doctor.experience ? doctor.experience + ' years experience' : ''}</p>
                    <button class="btn-book" onclick="openBookingModal('${doctor.id}', '${doctor.fullName}')">
                        Book Appointment
                    </button>
                </div>
            `).join('');
            container.innerHTML = doctorsHTML;
        } else {
            const doctorsHTML = filteredDoctors.map(doctor => `
                <div class="doctor-card">
                    <div class="doctor-avatar">${doctor.fullName.charAt(0)}</div>
                    <h3>Dr. ${doctor.fullName}</h3>
                    <p class="specialization">${doctor.specialization || 'General Physician'}</p>
                    <p class="experience">${doctor.experience ? doctor.experience + ' years experience' : ''}</p>
                    <p class="qualifications">${doctor.qualifications || ''}</p>
                    ${doctor.bio ? `<p class="bio">${doctor.bio}</p>` : ''}
                    <p class="contact">Contact: ${doctor.phoneNumber || 'Not available'}</p>
                </div>
            `).join('');
            container.innerHTML = doctorsHTML;
        }

    } catch (error) {
        console.error('Error loading doctors:', error);
        container.innerHTML = '<p class="error">Error loading doctors. Please try again later.</p>';
    }
}

window.openBookingModal = async (doctorId, doctorName) => {
    const modal = document.getElementById('bookingModal');
    const timeSlotsContainer = document.querySelector('.time-slots');
    const dateSelector = document.querySelector('.date-selector');
    const confirmButton = document.getElementById('confirmBooking');
    
    timeSlotsContainer.innerHTML = '<p>Select a date to view available slots</p>';
    dateSelector.innerHTML = ''; 
    confirmButton.disabled = true;
    
    document.getElementById('selectedDoctorName').textContent = `Dr. ${doctorName}`;
    
    modal.classList.add('show');
    
    await loadAvailableDates(doctorId);
};

async function loadAvailableDates(doctorId) {
    const dateSelector = document.querySelector('.date-selector');
    const dates = [];
    
    for(let i = 0; i < 3; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        dates.push(date);
    }

    let datesHTML = dates.map(date => `
        <div class="date-option" 
             data-date="${date.toISOString().split('T')[0]}" 
             data-doctor="${doctorId}">
            ${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </div>
    `).join('');

    dateSelector.innerHTML = datesHTML;

    dateSelector.querySelectorAll('.date-option').forEach(dateOption => {
        dateOption.addEventListener('click', async () => {

            document.querySelectorAll('.date-option').forEach(opt => opt.classList.remove('selected'));
            document.querySelector('.time-slots').innerHTML = '<p>Loading available slots...</p>';
            document.getElementById('confirmBooking').disabled = true;
            
            dateOption.classList.add('selected');
            const selectedDate = dateOption.dataset.date;
            const selectedDoctorId = dateOption.dataset.doctor;
            await loadTimeSlots(selectedDoctorId, selectedDate);
        });
    });
}

async function loadTimeSlots(doctorId, date) {
    const timeSlotsContainer = document.querySelector('.time-slots');
    document.getElementById('confirmBooking').disabled = true;
    
    try {
        timeSlotsContainer.innerHTML = '<p>Loading available slots...</p>';

        const availabilityRef = doc(db, 'doctorAvailability', `${doctorId}_${date}`);
        const availabilityDoc = await getDoc(availabilityRef);

        if (!availabilityDoc.exists()) {
            timeSlotsContainer.innerHTML = '<p class="not-available">Doctor has not set availability for this date</p>';
            return;
        }

        const availability = availabilityDoc.data();

        if (!availability.available) {
            timeSlotsContainer.innerHTML = '<p class="not-available">Doctor is not available on this date</p>';
            return;
        }

        // Get all slots from both morning and evening sessions
        const allSlots = [];
        
        if (availability.morningSessions && availability.morningSessions.length > 0) {
            const morningSlots = generateTimeSlots(availability.morningSessions, availability.slotDuration || 30);
            allSlots.push(...morningSlots);
        }
        
        if (availability.eveningSessions && availability.eveningSessions.length > 0) {
            const eveningSlots = generateTimeSlots(availability.eveningSessions, availability.slotDuration || 30);
            allSlots.push(...eveningSlots);
        }

        // Sort slots chronologically
        allSlots.sort();

        const appointmentsQuery = query(
            collection(db, 'appointments'),
            where('doctorId', '==', doctorId),
            where('date', '==', date)
        );
        const appointmentsSnapshot = await getDocs(appointmentsQuery);
        const bookedSlots = new Map();
        
        appointmentsSnapshot.docs.forEach(doc => {
            const appointmentData = doc.data();
            bookedSlots.set(appointmentData.time, appointmentData.patientName);
        });

        const now = new Date();
        const today = new Date().toISOString().split('T')[0];
        const currentTime = formatTime(now);
        const filteredSlots = date === today ? allSlots.filter(slot => slot > currentTime) : allSlots;

        if (filteredSlots.length === 0) {
            timeSlotsContainer.innerHTML = '<p class="no-slots">No slots available for this date</p>';
            return;
        }

        const slotsHTML = filteredSlots.map(slot => {
            const isBooked = bookedSlots.has(slot);
            const bookedBy = bookedSlots.get(slot);
            const isMyBooking = bookedBy === currentPatient.fullName;

            return `
                <div class="time-slot ${isBooked ? 'unavailable' : 'available'}" 
                     data-time="${slot}"
                     ${!isBooked ? 'onclick="selectTimeSlot(this)"' : ''}>
                    ${formatDisplayTime(slot)}
                    ${isBooked ? `
                        <span class="slot-status">
                            ${isMyBooking ? 'Your booking' : 'Booked'}
                        </span>
                    ` : ''}
                </div>
            `;
        }).join('');

        timeSlotsContainer.innerHTML = slotsHTML;

    } catch (error) {
        console.error('Error loading time slots:', error);
        timeSlotsContainer.innerHTML = '<p class="error">Error loading time slots</p>';
    }
}

function generateTimeSlots(sessions, duration) {
    let slots = [];
    if (!Array.isArray(sessions)) return slots;
    
    sessions.forEach(session => {
        if (!session.startTime || !session.endTime) return;
        
        let start = parseTime(session.startTime);
        const end = parseTime(session.endTime);
        
        while (start < end) {
            slots.push(formatTime(start));
            start.setMinutes(start.getMinutes() + (duration || 30));
        }
    });
    
    return slots;
}

function parseTime(timeString) {
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return date;
}

function formatTime(date) {
    return date.toTimeString().substring(0, 5);
}

function formatDisplayTime(timeString) {
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
    });
}

window.selectTimeSlot = (element) => {
    document.querySelectorAll('.time-slot').forEach(slot => slot.classList.remove('selected'));
    element.classList.add('selected');
    document.getElementById('confirmBooking').disabled = false;
};

document.getElementById('confirmBooking')?.addEventListener('click', async () => {
    const selectedDate = document.querySelector('.date-option.selected')?.dataset.date;
    const selectedDoctorId = document.querySelector('.date-option.selected')?.dataset.doctor;
    const selectedTime = document.querySelector('.time-slot.selected')?.dataset.time;
    const doctorName = document.getElementById('selectedDoctorName').textContent.replace('Dr. ', '');
    
    if (!selectedDate || !selectedTime || !selectedDoctorId) {
        alert('Please select both date and time');
        return;
    }

    try {
        const timeSlotQuery = query(
            collection(db, 'appointments'),
            where('date', '==', selectedDate),
            where('time', '==', selectedTime)
        );
        
        const timeSlotCheck = await getDocs(timeSlotQuery);
        if (!timeSlotCheck.empty) {
            alert('This time slot has just been booked. Please select another time.');
            await loadTimeSlots(selectedDoctorId, selectedDate);
            return;
        }

        const conflictingAppointmentsQuery = query(
            collection(db, 'appointments'),
            where('patientId', '==', currentPatient.uid),
            where('date', '==', selectedDate),
            where('time', '==', selectedTime)
        );

        const conflictingAppointments = await getDocs(conflictingAppointmentsQuery);
        if (!conflictingAppointments.empty) {
            const existing = conflictingAppointments.docs[0].data();
            alert(`You already have an appointment with Dr. ${existing.doctorName} at this time.`);
            return;
        }

        const sameDoctorAppointmentsQuery = query(
            collection(db, 'appointments'),
            where('patientId', '==', currentPatient.uid),
            where('date', '==', selectedDate),
            where('doctorId', '==', selectedDoctorId)
        );

        const sameDoctorAppointments = await getDocs(sameDoctorAppointmentsQuery);
        if (!sameDoctorAppointments.empty) {
            alert(`You already have an appointment with Dr. ${doctorName} on ${formatDate(selectedDate)}. Please choose a different date.`);
            return;
        }

        const appointmentData = {
            doctorId: selectedDoctorId,
            patientId: currentPatient.uid,
            patientName: currentPatient.fullName,
            doctorName: doctorName,
            date: selectedDate,
            time: selectedTime,
            status: 'scheduled',
            createdAt: new Date().toISOString()
        };

        await addDoc(collection(db, 'appointments'), appointmentData);
        
        // Send booking confirmation email
        const emailResponse = await fetch("https://sendbookingemail-7l3qrqrksq-uc.a.run.app", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                patientEmail: currentPatient.email,
                patientName: currentPatient.fullName,
                doctorName: doctorName,
                date: formatDate(selectedDate),  // Use formatted date
                time: formatDisplayTime(selectedTime)  // Use formatted time
            })
        });

        if (!emailResponse.ok) {
            throw new Error(`Email service error: ${emailResponse.status}`);
        }

        const emailResult = await emailResponse.json();
        console.log("Booking email status:", emailResult);

        await addDoc(collection(db, 'notifications'), {
            doctorId: selectedDoctorId,
            patientId: currentPatient.uid,
            patientName: currentPatient.fullName,
            doctorName: doctorName,
            type: 'booking',
            appointmentDate: selectedDate,
            appointmentTime: selectedTime,
            timestamp: new Date().toISOString(),
            read: false,
            message: `New appointment scheduled with ${currentPatient.fullName} for ${formatDate(selectedDate)} at ${selectedTime}`
        });

        alert('Appointment booked successfully! A confirmation email has been sent.');
        document.getElementById('bookingModal').classList.remove('show');
        loadAppointments();
    } catch (error) {
        console.error('Error in booking process:', error);
        alert('Appointment booked, but there was an error sending the confirmation email.');
        document.getElementById('bookingModal').classList.remove('show');
        loadAppointments();
    }
});

document.querySelector('.close')?.addEventListener('click', () => {
    document.getElementById('bookingModal').classList.remove('show');
});

window.onclick = (event) => {
    const modal = document.getElementById('bookingModal');
    if (event.target === modal) {
        modal.classList.remove('show');
    }
};

async function loadAppointments() {
    const appointmentsContainer = document.querySelector('.appointments-container');
    try {
        appointmentsContainer.innerHTML = '';

        const appointmentsQuery = query(
            collection(db, 'appointments'),
            where('patientId', '==', currentPatient.uid),
            orderBy('date', 'desc')
        );

        const snapshot = await getDocs(appointmentsQuery);
        
        const currentDate = new Date().toISOString().split('T')[0];
        const now = new Date();
        const upcomingAppointments = [];
        const completedAppointments = [];

        snapshot.docs.forEach(doc => {
            const appointment = { id: doc.id, ...doc.data() };
            const appointmentDateTime = new Date(`${appointment.date}T${appointment.time}`);

            if (appointmentDateTime <= now || appointment.status === 'completed') {
                completedAppointments.push(appointment);
            } else {
                upcomingAppointments.push(appointment);
            }
        });

        let upcomingHTML = `
            <h3>Upcoming Appointments</h3>
            <table class="appointments-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Doctor</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        if (upcomingAppointments.length === 0) {
            upcomingHTML += '<tr><td colspan="5">No upcoming appointments</td></tr>';
        } else {
            upcomingAppointments.forEach(appointment => {
                const date = new Date(appointment.date).toLocaleDateString();
                upcomingHTML += `
                    <tr>
                        <td>${date}</td>
                        <td>${appointment.time}</td>
                        <td>${appointment.doctorName}</td>
                        <td>${appointment.status}</td>
                        <td>
                            <button class="btn-delete" onclick="deleteAppointment('${appointment.id}', '${appointment.doctorId}')">
                                Cancel
                            </button>
                        </td>
                    </tr>
                `;
            });
        }
        upcomingHTML += '</tbody></table>';

        let completedHTML = '<h3>Completed Appointments</h3>';
        completedHTML += `
            <table class="appointments-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Doctor</th>
                        <th>Report</th>
                    </tr>
                </thead>
                <tbody>
        `;

        if (completedAppointments.length === 0) {
            completedHTML += '<tr><td colspan="4">No completed appointments</td></tr>';
        } else {
            for (const appointment of completedAppointments) {
                const date = new Date(appointment.date).toLocaleDateString();
                const report = await getAppointmentReport(appointment.id, appointment.patientId);
                completedHTML += `
                    <tr>
                        <td>${date}</td>
                        <td>${appointment.time}</td>
                        <td>${appointment.doctorName}</td>
                        <td>
                            ${report ? 
                                `<button class="btn-view-report" onclick="openReportModal('${encodeURIComponent(JSON.stringify(report))}')">
                                    View Report
                                </button>` : 
                                'Not available'}
                        </td>
                    </tr>
                `;
            }
        }
        completedHTML += '</tbody></table>';

        if (upcomingAppointments.length === 0 && completedAppointments.length === 0) {
            appointmentsContainer.innerHTML = '<p class="empty-message">No appointments found.</p>';
        } else {
            appointmentsContainer.innerHTML = upcomingHTML + completedHTML;
        }

    } catch (error) {
        console.error('Error loading appointments:', error);
        appointmentsContainer.innerHTML = '<p class="error">Error loading appointments</p>';
    }
}

window.deleteAppointment = async (appointmentId, doctorId) => {
    if (confirm('Are you sure you want to cancel this appointment?')) {
        try {
            const appointmentDoc = await getDoc(doc(db, 'appointments', appointmentId));
            const appointmentData = appointmentDoc.data();

            await deleteDoc(doc(db, 'appointments', appointmentId));

            try {
                const response = await fetch("https://sendcancellationemail-7l3qrqrksq-uc.a.run.app", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        patientEmail: currentPatient.email,
                        patientName: currentPatient.fullName,
                        doctorName: appointmentData.doctorName,
                        date: appointmentData.date,
                        time: appointmentData.time
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                console.log("Cancellation email sent!", data);

            } catch (emailError) {
                console.error('Error calling sendCancellationEmail function:', emailError);
                alert('Error sending cancellation email. Please try again.');
            }

            await addDoc(collection(db, 'notifications'), {
                doctorId: doctorId,
                patientId: currentPatient.uid,
                patientName: currentPatient.fullName,
                doctorName: appointmentData.doctorName,
                type: 'cancellation',
                timestamp: new Date().toISOString(),
                read: false,
                appointmentDate: appointmentData.date,
                appointmentTime: appointmentData.time,
                message: `Appointment with Dr. ${appointmentData.doctorName} for ${formatDate(appointmentData.date)} at ${appointmentData.time} was cancelled`
            });

            alert('Appointment cancelled successfully');
            loadAppointments();
        } catch (error) {
            console.error('Error cancelling appointment:', error);
            alert('Error cancelling appointment');
        }
    }
};

async function getAppointmentReport(appointmentId, patientId) {
    try {
        const reportsQuery = query(
            collection(db, `patients/${patientId}/medical-records`),
            where('appointmentId', '==', appointmentId)
        );
        const snapshot = await getDocs(reportsQuery);
        return snapshot.empty ? null : snapshot.docs[0].data();
    } catch (error) {
        console.error('Error fetching report:', error);
        return null;
    }
}

window.openReportModal = (reportData) => {
    const decodedReportData = decodeURIComponent(reportData);
    const report = JSON.parse(decodedReportData);
    const modalContent = `
        <p><strong>Height:</strong> ${report.height} cm</p>
        <p><strong>Weight:</strong> ${report.weight} kg</p>
        <p><strong>Problems:</strong> ${report.problems || 'N/A'}</p>
        <p><strong>Diagnosis:</strong> ${report.diagnosis}</p>
        <p><strong>Prescription:</strong> ${report.prescription}</p>
        <p><strong>Doctor:</strong> ${report.doctorName}</p>
        <p><strong>Date:</strong> ${new Date(report.date).toLocaleDateString()}</p>
    `;

    document.getElementById('reportDetails').innerHTML = modalContent;
    document.getElementById('reportModal').style.display = 'block';
};

window.closeReportModal = () => {
    document.getElementById('reportModal').style.display = 'none';
};

async function loadNotifications() {
    const container = document.querySelector('.notifications-container');
    try {
        container.innerHTML = '<p>Loading notifications...</p>';

        if (!currentPatient || !currentPatient.uid) {
            throw new Error('Patient data not found');
        }

        const notificationsQuery = query(
            collection(db, 'notifications'),
            where('patientId', '==', currentPatient.uid),
            orderBy('timestamp', 'desc')
        );

        const snapshot = await getDocs(notificationsQuery);
        
        if (snapshot.empty) {
            container.innerHTML = '<p class="no-notifications">No notifications yet</p>';
            return;
        }

        let notificationsHTML = '';
        const markReadPromises = [];

        snapshot.forEach(doc => {
            const notification = doc.data();
            const timeAgo = getTimeAgo(notification.timestamp);
            
            notificationsHTML += `
                <div class="notification-item ${notification.read ? '' : 'unread'}">
                    <span class="notification-time">${timeAgo}</span>
                    <div class="notification-content">
                        <div class="notification-title">
                            ${getNotificationTitle(notification)}
                        </div>
                        <div class="notification-details">
                            ${getNotificationDetails(notification)}
                        </div>
                    </div>
                </div>
            `;

            if (!notification.read) {
                markReadPromises.push(
                    updateDoc(doc.ref, { 
                        read: true,
                        readAt: new Date().toISOString()
                    })
                );
            }
        });

        container.innerHTML = notificationsHTML;

        await Promise.all(markReadPromises);

    } catch (error) {
        console.error('Error loading notifications:', error);
        container.innerHTML = '<p class="error">Error loading notifications. Please try again later.</p>';
    }
}

function getNotificationTitle(notification) {
    switch (notification.type) {
        case 'booking':
            return 'New Appointment Scheduled';
        case 'cancellation':
            return 'Appointment Cancelled';
        case 'report_available':
            return 'Medical Report Available';
        case 'appointment_reminder':
            return 'Appointment Reminder';
        case 'appointment_update':
            return 'Appointment Updated';
        default:
            return 'New Notification';
    }
}

function getNotificationDetails(notification) {
    switch (notification.type) {
        case 'booking':
            return `Your appointment with Dr. ${notification.doctorName} is scheduled for 
                   ${formatDate(notification.appointmentDate)} at ${notification.appointmentTime}`;
        case 'cancellation':
            return `Your appointment with Dr. ${notification.doctorName} for 
                   ${formatDate(notification.appointmentDate)} has been cancelled`;
        case 'report_available':
            return `Dr. ${notification.doctorName} has uploaded your medical report. 
                   You can view it in your completed appointments`;
        case 'appointment_reminder':
            return `Reminder: You have an appointment with Dr. ${notification.doctorName} tomorrow at 
                   ${notification.appointmentTime}`;
        case 'appointment_update':
            return `Your appointment with Dr. ${notification.doctorName} has been updated. 
                   Please check your appointments for details`;
        default:
            return notification.message || '';
    }
}

function formatDate(dateString) {
    const options = { 
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

function getTimeAgo(timestamp) {
    const now = new Date();
    const notificationDate = new Date(timestamp);
    const diffInSeconds = Math.floor((now - notificationDate) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 172800) return 'Yesterday';
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return notificationDate.toLocaleDateString();
}

window.handleDoctorSearch = debounce((event) => {
    const searchTerm = event.target.value.trim();
    loadDoctors(searchTerm);
}, 300);

async function loadProfile() {
    const profileContainer = document.querySelector('.profile-container');
    try {
        const formHTML = `
            <form id="profileForm" class="profile-form">
                <div class="profile-header">
                    <div class="profile-avatar">
                        <span class="avatar-text">${currentPatient.fullName.charAt(0)}</span>
                    </div>
                    <h3>Personal Information</h3>
                </div>
                <div class="profile-fields">
                    <div class="form-group">
                        <label for="fullName">Full Name</label>
                        <input type="text" id="fullName" value="${currentPatient.fullName || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="email">Email</label>
                        <input type="email" id="email" value="${currentPatient.email || ''}" readonly>
                    </div>
                    <div class="form-group">
                        <label for="phoneNumber">Phone Number</label>
                        <input type="tel" id="phoneNumber" 
                               value="${currentPatient.phoneNumber || ''}" 
                               pattern="[0-9]{10}" 
                               required>
                    </div>
                    <div class="form-group">
                        <label for="dateOfBirth">Date of Birth</label>
                        <input type="date" id="dateOfBirth" 
                               value="${currentPatient.dateOfBirth || ''}" 
                               required>
                    </div>
                    <div class="form-group">
                        <label for="address">Address</label>
                        <textarea id="address" rows="3" required>${currentPatient.address || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label for="emergencyContact">Emergency Contact</label>
                        <input type="tel" id="emergencyContact" 
                               value="${currentPatient.emergencyContact || ''}" 
                               pattern="[0-9]{10}">
                    </div>
                    <div class="form-group">
                        <label for="bloodGroup">Blood Group</label>
                        <select id="bloodGroup">
                            ${['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']
                                .map(group => `<option value="${group}" 
                                    ${currentPatient.bloodGroup === group ? 'selected' : ''}>
                                    ${group}
                                </option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="profile-actions">
                    <button type="submit" class="btn-save-profile">Save Changes</button>
                </div>
            </form>
        `;

        profileContainer.innerHTML = formHTML;

        document.getElementById('profileForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            submitButton.disabled = true;

            try {
                const updatedData = {
                    fullName: document.getElementById('fullName').value,
                    phoneNumber: document.getElementById('phoneNumber').value,
                    dateOfBirth: document.getElementById('dateOfBirth').value,
                    address: document.getElementById('address').value,
                    emergencyContact: document.getElementById('emergencyContact').value,
                    bloodGroup: document.getElementById('bloodGroup').value,
                    updatedAt: new Date().toISOString()
                };

                await updateDoc(doc(db, 'users', currentPatient.uid), updatedData);
                
                const newData = { ...currentPatient, ...updatedData };
                sessionStorage.setItem('userData', JSON.stringify(newData));
                currentPatient = newData;

                document.getElementById('patientName').textContent = updatedData.fullName;
                document.getElementById('welcomeName').textContent = updatedData.fullName;

                alert('Profile updated successfully!');
            } catch (error) {
                console.error('Error updating profile:', error);
                alert('Error updating profile. Please try again.');
            } finally {
                submitButton.disabled = false;
            }
        });

    } catch (error) {
        console.error('Error loading profile:', error);
        profileContainer.innerHTML = '<p class="error">Error loading profile data</p>';
    }
}

async function handleAvailabilityChange(doctorId, unavailableDate) {
    try {
        const affectedAppointmentsQuery = query(
            collection(db, 'appointments'),
            where('doctorId', '==', doctorId),
            where('date', '==', unavailableDate),
            where('status', '==', 'scheduled'),
            orderBy('time', 'asc')
        );

        const snapshot = await getDocs(affectedAppointmentsQuery);
        if (snapshot.empty) return;

        for (const appointmentDoc of snapshot.docs) {
            const appointment = appointmentDoc.data();
            const newSlot = await findNextAvailableSlot(doctorId, appointment.time, unavailableDate);

            if (newSlot) {
                await updateDoc(doc(db, 'appointments', appointmentDoc.id), {
                    date: newSlot.date,
                    time: newSlot.time,
                    rescheduled: true
                });

                await addDoc(collection(db, 'notifications'), {
                    doctorId: doctorId,
                    patientId: appointment.patientId,
                    patientName: appointment.patientName,
                    doctorName: appointment.doctorName,
                    type: 'appointment_update',
                    oldDate: unavailableDate,
                    oldTime: appointment.time,
                    appointmentDate: newSlot.date,
                    appointmentTime: newSlot.time,
                    timestamp: new Date().toISOString(),
                    read: false,
                    message: `Your appointment has been automatically rescheduled due to doctor unavailability`
                });
            } else {
                await deleteDoc(doc(db, 'appointments', appointmentDoc.id));
                
                await addDoc(collection(db, 'notifications'), {
                    doctorId: doctorId,
                    patientId: appointment.patientId,
                    patientName: appointment.patientName,
                    doctorName: appointment.doctorName,
                    type: 'cancellation',
                    appointmentDate: unavailableDate,
                    appointmentTime: appointment.time,
                    timestamp: new Date().toISOString(),
                    read: false,
                    message: `Your appointment was cancelled as no alternative slots were available`
                });
            }
        }
    } catch (error) {
        console.error('Error handling availability change:', error);
    }
}

async function findNextAvailableSlot(doctorId, preferredTime, startDate) {
    for (let i = 1; i <= 7; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateString = date.toISOString().split('T')[0];

        const availabilityDoc = await getDoc(doc(db, 'doctorAvailability', `${doctorId}_${dateString}`));
        
        if (!availabilityDoc.exists() || !availabilityDoc.data().available) {
            continue;
        }

        const appointmentsQuery = query(
            collection(db, 'appointments'),
            where('doctorId', '==', doctorId),
            where('date', '==', dateString)
        );
        const appointmentsSnapshot = await getDocs(appointmentsQuery);
        const bookedTimes = new Set(appointmentsSnapshot.docs.map(doc => doc.data().time));

        const availability = availabilityDoc.data();
        const slots = generateTimeSlots(availability.sessions, availability.slotDuration || 30);

        const preferredTimeMinutes = timeToMinutes(preferredTime);
        let bestSlot = null;
        let minTimeDiff = Infinity;

        for (const slot of slots) {
            if (!bookedTimes.has(slot)) {
                const slotMinutes = timeToMinutes(slot);
                const timeDiff = Math.abs(slotMinutes - preferredTimeMinutes);
                
                if (timeDiff < minTimeDiff) {
                    minTimeDiff = timeDiff;
                    bestSlot = slot;
                }
            }
        }

        if (bestSlot) {
            return { date: dateString, time: bestSlot };
        }
    }

    return null;
}

function timeToMinutes(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
}

async function setupAvailabilityChangeListener() {
    const appointmentsQuery = query(
        collection(db, 'appointments'),
        where('patientId', '==', currentPatient.uid),
        where('status', '==', 'scheduled')
    );

    onSnapshot(collection(db, 'doctorAvailability'), async (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'modified') {
                const availabilityData = change.doc.data();
                const [doctorId, date] = change.doc.id.split('_');

                if (!availabilityData.available) {
                    const affected = await getDocs(appointmentsQuery);
                    affected.forEach(doc => {
                        const appointment = doc.data();
                        if (appointment.doctorId === doctorId && appointment.date === date) {
                            handleAvailabilityChange(doctorId, date);
                        }
                    });
                }
            }
        });
    });
}
