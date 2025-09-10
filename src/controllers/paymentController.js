import Paystack from 'paystack';
import connectDB from '../../lib/mongodb.js';
import jwt from 'jsonwebtoken';
import { sendPaymentConfirmationEmail } from '../../lib/email.js';

const paystack = Paystack(process.env.PAYSTACK_SECRET_KEY);

export const initializePayment = async (req, res) => {
    try {
        const { email, amount, courseId, paymentMethod = 'mobile_money' } = req.body;
        
        // Set currency to GHS (Ghanaian Cedi)
        // Paystack will automatically show available payment methods based on this currency
        const currency = 'GHS';
        
        // Convert amount to the smallest currency unit (pesewas for GHS)
        // 1 GHS = 100 pesewas
        const amountInPesewas = Math.round(amount * 100);
        
        // Check if payment already exists for this user and course
        const db = await connectDB();
        const existingPayment = await db.collection('transactions').findOne({
            userId: req.user.userId,
            courseId,
            status: { $in: ['success', 'pending'] }
        });

        // If payment exists and is successful, redirect to dashboard
        if (existingPayment?.status === 'success') {
            return res.json({
                status: 'already_paid',
                redirectUrl: '/student/dashboard'
            });
        }

        // If payment exists but is pending, return the existing payment URL
        if (existingPayment?.status === 'pending' && existingPayment?.authorizationUrl) {
            return res.json({
                status: 'pending_payment',
                authorization_url: existingPayment.authorizationUrl
            });
        }

        // Create new transaction record
        const paymentRecord = {
            userId: req.user.userId,
            email,
            courseId,
            amount: amountInPesewas,
            currency: 'GHS',
            paymentMethod,
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Validate payment method
        const validPaymentMethods = ['mobile_money', 'card'];
        if (!validPaymentMethods.includes(paymentMethod)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid payment method. Please use either mobile_money or card.'
            });
        }

        // Initialize payment with Paystack
        // Paystack will automatically show available payment methods based on the currency
        const paymentDetails = {
            email,
            amount: amountInPesewas,
            currency: currency,
            metadata: {
                userId: req.user.userId,
                courseId,
                paymentMethod,
                userCountry: req.user.country || 'GH',
                currency: currency
            },
            // Let Paystack handle the available payment methods based on the currency
            // We still pass the paymentMethod to track it in our system
            channels: [paymentMethod],
            callback_url: `${process.env.FRONTEND_URL}/apply/success`,
            reference: `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        };

        const response = await paystack.transaction.initialize(paymentDetails);
        
        // Update payment record with Paystack reference and authorization URL
        paymentRecord.paymentReference = response.data.reference;
        paymentRecord.authorizationUrl = response.data.authorization_url;
        
        // Save transaction record to database
        await db.collection('transactions').insertOne(paymentRecord);
        
        return res.json({
            status: 'pending_payment',
            authorization_url: response.data.authorization_url
        });
        
    } catch (error) {
        console.error('Payment initialization error:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to initialize payment',
            error: error.message
        });
    }
};

export const verifyPayment = async (req, res) => {
    try {
        const { reference, trxref } = req.query;
        const paymentReference = reference || trxref;
        
        if (!paymentReference) {
            return res.status(400).json({
                status: 'error',
                message: 'Payment reference is required'
            });
        }

        // Verify payment with Paystack
        const response = await paystack.transaction.verify(paymentReference);
        const db = await connectDB();
        
        // Find the transaction record
        const payment = await db.collection('transactions').findOne({
            paymentReference: paymentReference
        });

        if (!payment) {
            return res.status(404).json({
                status: 'error',
                message: 'Payment record not found'
            });
        }

        // Update payment status based on Paystack response
        if (response.data.status === 'success') {
            // Update transaction status to success
            await db.collection('transactions').updateOne(
                { paymentReference: paymentReference },
                { 
                    $set: { 
                        status: 'success',
                        updatedAt: new Date()
                    } 
                }
            );

            // Enroll user in the course
            const enrollment = {
                userId: payment.userId,
                courseId: payment.courseId,
                transactionId: payment._id,
                enrolledAt: new Date(),
                status: 'active'
            };

            await db.collection('enrollments').insertOne(enrollment);

            // Get course details for email
            const course = await db.collection('courses').findOne({ _id: payment.courseId });
            const user = await db.collection('users').findOne({ _id: payment.userId });

            // Send payment confirmation email
            try {
                const origin = req.headers.origin || 'https://skillspad.vercel.app';
                await sendPaymentConfirmationEmail(
                    { 
                        name: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Student',
                        email: user?.email || payment.email 
                    },
                    {
                        title: course?.title || 'Your Course',
                        amount: payment.amount / 100,
                        currency: payment.currency || 'GHS'
                    },
                    origin
                );
            } catch (emailError) {
                console.error('Failed to send payment confirmation email:', emailError);
                // Don't fail the payment if email sending fails
            }

            // Update user's payment status
            await db.collection('users').updateOne(
                { _id: payment.userId },
                {
                    $set: {
                        'payment.status': 'success',
                        'payment.paidAt': new Date(),
                        'payment.courseId': payment.courseId,
                        updatedAt: new Date()
                    },
                    $addToSet: { enrolledCourses: payment.courseId }
                }
            );

            // Get user and update payment status
            const userData = await db.collection('users').findOne({ _id: payment.userId });
            
            if (!userData) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Generate JWT token with updated user data
            const token = jwt.sign(
                { 
                    userId: userData._id, 
                    email: userData.email, 
                    role: userData.role 
                }, 
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            // Set token in HTTP-only cookie
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });

            // Redirect to success page or dashboard
            return res.redirect(`${process.env.FRONTEND_URL}/apply/success?payment=success`);
        } else {
            // Update payment as failed
            await db.collection('payments').updateOne(
                { _id: payment._id },
                {
                    $set: {
                        status: 'failed',
                        updatedAt: new Date(),
                        paymentDetails: response.data
                    }
                }
            );

            return res.redirect(`${process.env.FRONTEND_URL}/apply/success?payment=failed`);
        }
    } catch (error) {
        console.error('Payment verification error:', error);
        return res.redirect(`${process.env.FRONTEND_URL}/apply/success?payment=error`);
    }
};