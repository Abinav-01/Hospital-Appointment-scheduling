const functions = require("firebase-functions");
const nodemailer = require("nodemailer");
const admin = require("firebase-admin");
admin.initializeApp();

const gmailEmail = functions.config().gmail.email;
const gmailPassword = functions.config().gmail.password;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: gmailEmail,
    pass: gmailPassword,
  },
});

exports.sendEmail = functions.https.onCall(async (data, context) => {
  const { email, subject, message } = data;

  const mailOptions = {
    from: `CityCare Hospital <${gmailEmail}>`,
    to: email,
    subject: subject,
    text: message,
    html: `<p>${message}</p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Email error:", error);
    return { success: false, error: error.toString() };
  }
});

exports.sendCancellationEmail = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const { patientEmail, patientName, doctorName, date, time } = req.body;

  // Construct email data
  const emailData = {
    type: "appointment_cancelled",
    patientEmail: patientEmail,
    patientName: patientName,
    doctorName: doctorName,
    date: date,
    time: time,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    status: "pending",
  };

  try {
    // Add to the mail collection
    await admin.firestore().collection("mail").add(emailData);
    res.status(200).send("Cancellation email added to queue.");
  } catch (error) {
    console.error("Error adding to mail collection:", error);
    res.status(500).send("Failed to add cancellation email to queue.");
  }
});
