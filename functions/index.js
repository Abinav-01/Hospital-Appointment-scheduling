const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const cors = require("cors")({ origin: true });
const logger = require("firebase-functions/logger");

admin.initializeApp();

// ✅ Correct way to access secrets
const emailUser = defineSecret("EMAIL_USER");
const emailPass = defineSecret("EMAIL_PASS");

// ✅ Booking email using 2nd Gen Function with secrets
exports.sendBookingEmail = onRequest(
    {
        secrets: [emailUser, emailPass],
    },
    (req, res) => {
        cors(req, res, async () => {
            const { patientEmail, patientName, doctorName, date, time } = req.body;

            logger.log("sendBookingEmail called", { patientEmail, patientName, doctorName, date, time });

            const transporter = nodemailer.createTransport({
                service: "gmail",
                auth: {
                    user: emailUser.value(),
                    pass: emailPass.value(),
                },
            });

            const mailOptions = {
                from: `CityCare Hospital <${emailUser.value()}>`,
                to: patientEmail,
                subject: "Appointment Booked",
                html: `
                    <p>Dear ${patientName},</p>
                    <p>Your appointment with Dr. ${doctorName} has been scheduled for ${date} at ${time}.</p>
                    <p>Thank you for choosing CityCare Hospital.</p>
                `,
            };

            try {
                await transporter.sendMail(mailOptions);
                logger.log("Email sent to:", patientEmail);
                res.status(200).send({ success: true, message: "Email sent successfully" });
            } catch (error) {
                logger.error("Email sending failed:", error);
                res.status(500).send({ success: false, message: "Error sending email" });
            }
        });
    }
);

// ❗ Cancellation email must also use defineSecret. Upgrade to 2nd Gen if needed
exports.sendCancellationEmail = onRequest(
    {
        secrets: [emailUser, emailPass],
    },
    (req, res) => {
        cors(req, res, async () => {
            const { patientEmail, patientName, doctorName, date, time } = req.body;

            logger.log("sendCancellationEmail called", { patientEmail, patientName, doctorName, date, time });

            const transporter = nodemailer.createTransport({
                service: "gmail",
                auth: {
                    user: emailUser.value(),
                    pass: emailPass.value(),
                },
            });

            const mailOptions = {
                from: `CityCare Hospital <${emailUser.value()}>`,
                to: patientEmail,
                subject: "Appointment Cancelled",
                html: `
                    <p>Dear ${patientName},</p>
                    <p>Your appointment with Dr. ${doctorName} scheduled for ${date} at ${time} has been cancelled.</p>
                    <p>We apologize for any inconvenience.</p>
                    <p>Thank you for choosing CityCare Hospital.</p>
                `,
            };

            try {
                await transporter.sendMail(mailOptions);
                logger.log("Cancellation email sent to:", patientEmail);
                res.status(200).send({ success: true, message: "Cancellation email sent successfully" });
            } catch (error) {
                logger.error("Error sending cancellation email:", error);
                res.status(500).send({ success: false, message: "Error sending cancellation email" });
            }
        });
    }
);

exports.sendRescheduleEmail = onRequest(
    {
        secrets: [emailUser, emailPass],
    },
    (req, res) => {
        cors(req, res, async () => {
            const { patientEmail, patientName, doctorName, oldDate, oldTime, newDate, newTime } = req.body;

            logger.log("sendRescheduleEmail called", { patientEmail, patientName, doctorName, oldDate, oldTime, newDate, newTime });

            const transporter = nodemailer.createTransport({
                service: "gmail",
                auth: {
                    user: emailUser.value(),
                    pass: emailPass.value(),
                },
            });

            const mailOptions = {
                from: `CityCare Hospital <${emailUser.value()}>`,
                to: patientEmail,
                subject: "Appointment Rescheduled",
                html: `
                    <p>Dear ${patientName},</p>
                    <p>Your appointment with Dr. ${doctorName} originally scheduled for ${oldDate} at ${oldTime} has been automatically rescheduled due to doctor unavailability.</p>
                    <p>Your new appointment is scheduled for ${newDate} at ${newTime}.</p>
                    <p>If you would like to change this appointment, please contact us.</p>
                    <p>We apologize for any inconvenience.</p>
                    <p>Thank you for choosing CityCare Hospital.</p>
                `,
            };

            try {
                await transporter.sendMail(mailOptions);
                logger.log("Reschedule email sent to:", patientEmail);
                res.status(200).send({ success: true, message: "Reschedule email sent successfully" });
            } catch (error) {
                logger.error("Error sending reschedule email:", error);
                res.status(500).send({ success: false, message: "Error sending reschedule email" });
            }
        });
    }
);
