
import connectDB from "../../lib/mongodb.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { sendWelcomeEmail, sendPasswordResetEmail } from "../../lib/email.js";
import { v4 as uuidv4 } from 'uuid';

// Helper function to detect country from request
const detectCountryFromRequest = async (req) => {
    try {
        // Try to get country from frontend (if already detected)
        if (req.body.country) return req.body.country;
        
        // If not provided, try to detect from IP
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        if (ip) {
            const response = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`);
            const data = await response.json();
            return data.countryCode || 'GH'; // Default to Ghana if detection fails
        }
    } catch (error) {
        console.error('Error detecting country:', error);
    }
    return 'GH'; // Default to Ghana if all else fails
};

export const apply = async (req, res) => {
    try {
        const {
            email,
            password,
            firstName,
            lastName,
            phone = "",
            education = "",
            experience = "",
            motivation = "",
            howHeard = "",
            startDate = "",
            githubProfile = "",
            country: frontendCountry
        } = req.body;
        
        // Detect country if not provided in request
        const country = frontendCountry || await detectCountryFromRequest(req);

        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const db = await connectDB();
        const users = db.collection("users");
        
        // Check if user already exists
        const existingUser = await users.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User with this email already exists" });
        }

        // Create user with hashed password
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = uuidv4();
        const newUser = {
            email,
            password: hashedPassword,
            firstName,
            lastName,
            phone,
            education,
            experience,
            motivation,
            howHeard,
            startDate,
            githubProfile,
            country,
            role: 'student',
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: true,
            emailVerified: false,
            verificationToken,
            verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        };

        const result = await users.insertOne(newUser);
        const userId = result.insertedId;
        
        // Send welcome email
        try {
            const origin = req.headers.origin || 'https://skillspad.vercel.app';
            await sendWelcomeEmail({
                name: `${firstName} ${lastName}`,
                email
            }, origin);
        } catch (emailError) {
            console.error('Failed to send welcome email:', emailError);
            // Don't fail the registration if email sending fails
        }

        // Generate JWT token with user info including country
        const token = jwt.sign(
            { 
                email: newUser.email, 
                role: newUser.role, 
                userId: result.insertedId,
                country: newUser.country || 'GH' // Include country in token
            }, 
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Set HTTP-only cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // Return success response with user data (without password)
        const { password: _, ...userWithoutPassword } = newUser;
        return res.status(201).json({
            success: true,
            message: 'Registration successful',
            user: userWithoutPassword
        });

    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ 
            success: false,
            message: 'Internal server error',
            error: error.message 
        });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ 
                success: false,
                message: 'Email and password are required' 
            });
        }

        const db = await connectDB();
        const users = db.collection("users");
        
        // Find user by email
        const user = await users.findOne({ email });
        if (!user) {
            return res.status(401).json({ 
                success: false,
                message: 'Invalid email or password' 
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ 
                success: false,
                message: 'Invalid email or password' 
            });
        }

        // Check for partial payments if user doesn't have a success status
        let paymentStatus = user.payment?.status || 'pending';
        if (paymentStatus !== 'success') {
            const partialPayment = await db.collection('partial_payments').findOne({
                userId: user._id,
                status: 'partially_paid'
            });
            
            if (partialPayment) {
                paymentStatus = 'partially_paid';
            }
        }

        // Generate JWT token with user info including country and payment status
        const token = jwt.sign(
            { 
                email: user.email, 
                role: user.role, 
                userId: user._id,
                country: user.country || 'GH', // Include country in token
                paymentStatus // Include payment status in token
            }, 
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Set HTTP-only cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // Return success response with user data (without password) and payment status
        const { password: _, ...userWithoutPassword } = {
            ...user,
            payment: {
                ...user.payment,
                status: paymentStatus
            }
        };
        return res.status(200).json({
            success: true,
            message: 'Login successful',
            user: userWithoutPassword
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ 
            success: false,
            message: 'Internal server error',
            error: error.message 
        });
    }
};

export const logout = async (req, res) => {
    try {
        // Clear the token cookie
        res.clearCookie('token');
        
        return res.status(200).json({
            success: true,
            message: 'Logout successful'
        });
    } catch (error) {
        console.error('Logout error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error during logout',
            error: error.message
        });
    }
};

/**
 * Initiate password reset process
 */
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const db = await connectDB();
        const users = db.collection("users");
        
        // Find user by email
        const user = await users.findOne({ email });
        
        // For security, don't reveal if the email exists or not
        if (!user) {
            return res.json({
                success: true,
                message: 'If your email is registered, you will receive a password reset link.'
            });
        }

        // Generate reset token
        const resetToken = uuidv4();
        const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

        // Store the reset token in the database
        await users.updateOne(
            { email: email.toLowerCase() },
            {
                $set: {
                    resetToken,
                    resetTokenExpires
                }
            }
        );
        
        // Send password reset email
        try {
            const origin = req.headers.origin || 'https://skillspad.vercel.app';
            await sendPasswordResetEmail(
                { email, name: user.firstName || 'User' },
                resetToken,
                origin
            );
        } catch (emailError) {
            console.error('Failed to send password reset email:', emailError);
            return res.status(500).json({ 
                success: false, 
                message: 'Error sending password reset email' 
            });
        }

        return res.json({
            success: true,
            message: 'If your email is registered, you will receive a password reset link.'
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error processing forgot password request',
            error: error.message
        });
    }
};

/**
 * Reset user's password
 */
export const resetPassword = async (req, res) => {
    try {
        const { token, email, password } = req.body;
        
        if (!token || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Token, email, and new password are required'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        const db = await connectDB();
        const users = db.collection("users");
        
        // Find user by email
        const user = await users.findOne({ email });
        
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }

        // Verify token
        try {
            const decoded = jwt.verify(
                token,
                process.env.JWT_SECRET + (user.password || '') // Same secret as in forgotPassword
            );
            
            if (decoded.email !== email) {
                throw new Error('Token email mismatch');
            }
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Update user password
        await users.updateOne(
            { _id: user._id },
            { 
                $set: { 
                    password: hashedPassword,
                    updatedAt: new Date()
                } 
            }
        );

        // Invalidate all existing sessions by changing the JWT secret
        // In a real app, you might want to implement a token blacklist
        
        return res.json({
            success: true,
            message: 'Password reset successful. You can now log in with your new password.'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error resetting password',
            error: error.message
        });
    }
};
