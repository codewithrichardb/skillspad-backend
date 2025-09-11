// controllers/paymentController.js
import axios from "axios";
import connectDB from "../../lib/mongodb.js";
import jwt from "jsonwebtoken";
import {
  sendPaymentConfirmationEmail,
  sendWelcomeEmail,
} from "../../lib/email.js";
import { ObjectId } from "mongodb";

const PAYSTACK_BASE = "https://api.paystack.co";

// Helper for Paystack requests
const paystackRequest = async (path, method = "GET", body = null) => {
  const isLive = process.env.NODE_ENV === "production";
  const key = isLive
    ? process.env.PAYSTACK_SECRET_KEY_LIVE
    : process.env.PAYSTACK_SECRET_KEY_TEST;

  if (!key) throw new Error("Paystack API key not configured");

  const config = {
    method,
    url: `${PAYSTACK_BASE}${path}`,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    data: body || undefined,
    timeout: 30000,
  };

  const response = await axios(config);
  if (!response.data.status) {
    throw new Error(response.data.message || "Invalid response from Paystack");
  }
  return response.data.data;
};

// ==============================
// Initialize Payment
// ==============================
export const initializePayment = async (req, res) => {
  try {
    const { email, amount, courseId, paymentMethod = "mobile_money" } = req.body;
    const userId = req.user?.userId;

    if (!userId || !email || !amount || !courseId) {
      return res
        .status(400)
        .json({ status: "error", message: "Missing required fields" });
    }

    const currency = "GHS";
    const amountInPesewas = Math.round(amount * 100);

    const db = await connectDB();

    //if user has already made payment
    const existingPayment = await db.collection("transactions").findOne({
      userId,
      courseId,
      status: "success",
    });
    if (existingPayment) {
      return res.status(400).json({
        status: "error",
        message: "You have already made payment for this course",
      });
    }

    // Generate unique reference
    const reference = `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    console.log("🆕 Generated reference:", reference);

    // Payload for Paystack
    const payload = {
      email,
      amount: amountInPesewas,
      currency,
      metadata: {
        userId: userId.toString(),
        courseId: courseId.toString(),
        paymentMethod,
      },
      channels: [paymentMethod],
      callback_url: `${process.env.FRONTEND_URL}/payment/verify`, // let Paystack append reference
      reference,
    };

    // Call Paystack
    const data = await paystackRequest("/transaction/initialize", "POST", payload);

    console.log("✅ Paystack Init Reference:", data.reference);
    console.log("✅ Paystack Auth URL:", data.authorization_url);

    // Save to DB
    const record = {
      userId: new ObjectId(userId),
      email,
      courseId,
      amount: amountInPesewas,
      currency,
      paymentMethod,
      status: "pending",
      paymentReference: data.reference,
      authorizationUrl: data.authorization_url,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await db.collection("transactions").insertOne(record);
    console.log("💾 Saved DB Reference:", record.paymentReference, "ID:", result.insertedId);

    return res.json({
      status: "pending_payment",
      authorization_url: data.authorization_url,
      reference: data.reference,
    });
  } catch (error) {
    console.error("Payment init error:", error.message, error.response?.data);
    return res
      .status(500)
      .json({ status: "error", message: "Payment initialization failed" });
  }
};

// ==============================
// Verify Payment
// ==============================
export const verifyPayment = async (req, res) => {
    try {
      const paymentReference = req.query.reference;
  
      if (!paymentReference) {
        return res.status(400).json({
          ok: false,
          status: "error",
          message: "Payment reference required",
        });
      }
  
      const db = await connectDB();
      const data = await paystackRequest(
        `/transaction/verify/${paymentReference}`,
        "GET"
      );
  
      const payment = await db
        .collection("transactions")
        .findOne({ paymentReference });
  
      if (!payment) {
        return res.status(404).json({
          ok: false,
          status: "error",
          message: "Payment record not found",
        });
      }

      console.log("Payment record found:", payment)
  
      if (data.status === "success") {
        await db.collection("transactions").updateOne(
          { paymentReference },
          { $set: { status: "success", updatedAt: new Date() } }
        );

        // First, get the user details
        const user = await db.collection('users').findOne({ _id: new ObjectId(payment.userId) });
        if (!user) {
          throw new Error('User not found');
        }

        // Update user's enrolled courses
        await db.collection("users").updateOne(
          { _id: new ObjectId(payment.userId) },
          { $addToSet: { enrolledCourses: new ObjectId(payment.courseId) } }
        );
  
        // Generate new JWT token with updated user data
        const token = jwt.sign(
          { 
            userId: payment.userId, 
            role: user.role,  
            email: user.email, 
            country: user.country || 'GH'
          },
          process.env.JWT_SECRET,
          { expiresIn: "7d" }
        );
  
        // Set HTTP-only cookie
        res.cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
  
        console.log("🎉 Payment verified & cookie issued:", paymentReference);
        const course = await db.collection('courses').findOne({ _id: payment.courseId });

        // Send payment confirmation email
        if (user?.email) {
          try {
             sendPaymentConfirmationEmail({
              email: user.email,
              name: user.name || 'Student',
              courseName: course?.title || 'the course',
              amount: payment.amount / 100, // Convert from kobo to Naira/GHC
              reference: paymentReference,
              paymentDate: new Date().toLocaleDateString(),
            }).then(() => {
              console.log("✅ Payment confirmation email sent");
            }).catch((emailError) => {
              console.error('Error sending email:', emailError);
            });

            // If this is the user's first payment, send welcome email
            const userPayments = await db.collection('transactions').countDocuments({
              userId: payment.userId,
              status: 'success'
            });

            if (userPayments === 1) {
              sendWelcomeEmail({
                email: user.email,
                name: user.name || 'Student',
                courseName: course?.title || 'your course'
              }).then(() => {
                console.log("✅ Welcome email sent");
              }).catch((emailError) => {
                console.error('Error sending email:', emailError);
              });
            }
          } catch (emailError) {
            console.error('Error sending email:', emailError);
            // Don't fail the request if email fails
          }
        }

        // ✅ Send JSON response
        return res.json({
          ok: true,
          status: "success",
          message: "Payment verified successfully",
          data,
        });
      } else {
        await db.collection("transactions").updateOne(
          { paymentReference },
          { $set: { status: "failed", updatedAt: new Date() } }
        );
  
        return res.json({
          ok: true,
          status: "failed",
          message: "Payment verification failed",
          data,
        });
      }
    } catch (error) {
      console.error("Payment verify error:", error.message, error.response?.data);
  
      return res.status(500).json({
        ok: false,
        status: "error",
        message: error.message || "Payment verification failed",
      });
    }
  };
  

