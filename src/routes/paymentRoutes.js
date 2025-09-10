import express from 'express';
import { initializePayment, verifyPayment } from '../controllers/paymentController.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = express.Router();

// Apply auth middleware to all payment routes
router.use(authMiddleware());

// Initialize payment (frontend expects POST /api/paystack/initialize)
router.post('/initialize', initializePayment);

// Verify payment (frontend will be redirected here after payment)
router.get('/verify', verifyPayment);

export default router;
