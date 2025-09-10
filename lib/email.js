import nodemailer from 'nodemailer';
import { getWelcomeEmailTemplate } from '../src/templates/welcomeEmail.js';
import { getPasswordResetEmailTemplate } from '../src/templates/passwordResetEmail.js';

// Create a transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.NODE_ENV === 'production', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

/**
 * Send a welcome email to a new user
 * @param {Object} user - User object containing name and email
 * @param {string} origin - The origin URL (e.g., https://yoursite.com)
 * @returns {Promise} Promise that resolves when the email is sent
 */
export const sendWelcomeEmail = async (user, origin) => {
    try {
        const mailOptions = {
            from: `"${process.env.SMTP_FROM_NAME || 'Skillspad'}" <${process.env.SMTP_FROM}>`,
            to: user.email,
            subject: 'Welcome to Skillspad!',
            html: getWelcomeEmailTemplate(user, origin)
        };

        await transporter.sendMail(mailOptions);
        console.log(`Welcome email sent to ${user.email}`);
        return true;
    } catch (error) {
        console.error('Error sending welcome email:', error);
        throw error;
    }
};

/**
 * Send a password reset email
 * @param {Object} user - User object containing name and email
 * @param {string} resetToken - The password reset token
 * @param {string} origin - The origin URL (e.g., https://yoursite.com)
 * @returns {Promise} Promise that resolves when the email is sent
 */
export const sendPasswordResetEmail = async (user, resetToken, origin) => {
    try {
        const resetLink = `${origin}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;
        
        const mailOptions = {
            from: `"${process.env.SMTP_FROM_NAME || 'Skillspad Support'}" <${process.env.SMTP_FROM}>`,
            to: user.email,
            subject: 'Password Reset Request',
            html: getPasswordResetEmailTemplate(user, resetLink, origin)
        };

        await transporter.sendMail(mailOptions);
        console.log(`Password reset email sent to ${user.email}`);
        return true;
    } catch (error) {
        console.error('Error sending password reset email:', error);
        throw error;
    }
};

/**
 * Send a payment confirmation email
 * @param {Object} user - User object containing name and email
 * @param {Object} course - Course details
 * @param {string} origin - The origin URL
 * @returns {Promise} Promise that resolves when the email is sent
 */
export const sendPaymentConfirmationEmail = async (user, course, origin) => {
    try {
        const mailOptions = {
            from: `"${process.env.SMTP_FROM_NAME || 'Skillspad'}" <${process.env.SMTP_FROM}>`,
            to: user.email,
            subject: `Payment Confirmation - ${course.title}`,
            html: `
                <h2>Thank you for your purchase, ${user.name}!</h2>
                <p>You have successfully enrolled in <strong>${course.title}</strong>.</p>
                <p>Start learning now by visiting your <a href="${origin}/dashboard">dashboard</a>.</p>
                <p>If you have any questions, feel free to reply to this email.</p>
                <p>Happy learning!<br>The Skillspad Team</p>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`Payment confirmation email sent to ${user.email}`);
        return true;
    } catch (error) {
        console.error('Error sending payment confirmation email:', error);
        throw error;
    }
};

export default {
    sendWelcomeEmail,
    sendPasswordResetEmail,
    sendPaymentConfirmationEmail
};
