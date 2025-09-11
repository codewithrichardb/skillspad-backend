
import connectDB from "../../lib/mongodb.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { sendWelcomeEmail, sendPasswordResetEmail } from "../../lib/email.js";
import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'mongodb';



export const apply = async (req, res) => {
    console.log('Received request body:', req.body);
    try {
        // Create a new object with only the properties we need
        const requestBody = {
            email: req.body?.email,
            password: req.body?.password,
            firstName: req.body?.firstName,
            lastName: req.body?.lastName,
            phone: req.body?.phone || "",
            education: req.body?.education || "",
            experience: req.body?.experience || "",
            motivation: req.body?.motivation || "",
            howHeard: req.body?.howHeard || "",
            startDate: req.body?.startDate || "",
            githubProfile: req.body?.githubProfile || "",
            country: req.body?.country || "GH"
        };
        
        console.log('Processed request body:', requestBody);
        
        // Destructure with defaults
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
            country = "GH" // Default to Ghana if not provided
        } = requestBody;
    
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

        // Generate JWT token with user info including country
        const token = jwt.sign(
            { 
                email: newUser.email, 
                role: newUser.role, 
                userId: result.insertedId.toString(), // Ensure userId is a string
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
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days,
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
        const transactions = db.collection("transactions");
        
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

        //find if user has made payment
        const existingPayment = await transactions.findOne({
            userId: user._id.toString(),
            status: 'success'
        });

        console.log(existingPayment)

        // Check for partial payments if user doesn't have a success status
        let paymentStatus = existingPayment?.status || 'pending';
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
                userId: user._id.toString(), 
                country: user.country || 'GH', 
                paymentStatus 
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
                status: paymentStatus
            }
        };
        return res.status(200).json({
            success: true,
            message: 'Login successful',
            user: userWithoutPassword,
            payment: {status: existingPayment?.status || 'pending'}
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

/**
 * Get current authenticated user's profile
 */
export const getCurrentUser = async (req, res) => {
    try {
        const db = await connectDB();
        const user = await db.collection('users').findOne(
            { _id: new ObjectId(req.user.userId) },
            { projection: { password: 0 } } // Exclude password from the response
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch user profile',
            error: error.message
        });
    }
};

/**
 * Update user profile
 */
export const updateProfile = async (req, res) => {
    try {
        const { firstName, lastName, phone, education, country, currentPassword, newPassword } = req.body;
        const db = await connectDB();
        
        // Get the current user
        const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.userId) });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Prepare update object
        const updateData = {};
        
        // Update basic profile fields if provided
        if (firstName) updateData.firstName = firstName;
        if (lastName) updateData.lastName = lastName;
        if (phone) updateData.phone = phone;
        if (education) updateData.education = education;
        if (country) updateData.country = country;

        // Handle password change if requested
        if (currentPassword && newPassword) {
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return res.status(400).json({
                    success: false,
                    message: 'Current password is incorrect'
                });
            }
            
            // Hash the new password
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(newPassword, salt);
        }

        // Update the user
        const result = await db.collection('users').updateOne(
            { _id: new ObjectId(req.user.userId) },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get updated user data (excluding password)
        const updatedUser = await db.collection('users').findOne(
            { _id: new ObjectId(req.user.userId) },
            { projection: { password: 0 } }
        );

        return res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: updatedUser
        });

    } catch (error) {
        console.error('Error updating profile:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update profile',
            error: error.message
        });
    }
};
