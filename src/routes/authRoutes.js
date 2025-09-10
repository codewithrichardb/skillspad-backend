import express from "express";
import { apply, login, logout, forgotPassword, resetPassword } from "../controllers/authController.js";
import { authMiddleware } from "../middlewares/auth.js";

const router = express.Router();

// Public routes
router.post("/apply", apply);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Protected routes
router.post("/logout", authMiddleware, logout);

// Add more protected routes here as needed
// router.get("/me", authMiddleware, getCurrentUser);
// router.put("/profile", authMiddleware, updateProfile);

export default router;
