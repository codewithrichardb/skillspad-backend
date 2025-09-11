import express from 'express';
import { initializePayment, verifyPayment } from '../controllers/paymentController.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = express.Router();

// Initialize payment - protected endpoint (requires auth)
router.post('/initialize', authMiddleware(), initializePayment);

// Verify payment - public endpoint (called by Paystack)
router.get('/verify', verifyPayment);

// Add webhook endpoint for Paystack to call
router.post('/webhook', (req, res) => {
  // This is a placeholder for webhook handling
  // You can implement webhook verification here if needed
  console.log('Webhook received:', req.body);
  res.status(200).json({ received: true });
});

export default router;
