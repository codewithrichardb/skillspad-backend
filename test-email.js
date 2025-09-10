import dotenv from 'dotenv';
import { sendWelcomeEmail } from './lib/email.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file in the backend directory
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Log environment variables for debugging
console.log('SMTP_HOST:', process.env.SMTP_HOST);
console.log('SMTP_PORT:', process.env.SMTP_PORT);
console.log('SMTP_USER:', process.env.SMTP_USER);
console.log('SMTP_FROM:', process.env.SMTP_FROM);

// Test user data
const testUser = {
    name: 'Test User',
    email: process.env.TEST_EMAIL || 'test@example.com'
};

// Test sending welcome email
async function testWelcomeEmail() {
    try {
        console.log('Sending test welcome email...');
        await sendWelcomeEmail(testUser, 'http://localhost:3000');
        console.log('Welcome email sent successfully!');
    } catch (error) {
        console.error('Error sending test email:', error);
    }
}

// Run the test
testWelcomeEmail();
