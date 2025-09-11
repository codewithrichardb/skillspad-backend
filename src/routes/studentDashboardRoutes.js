import express from 'express';
import { 
  getDashboardData,
  getStudentCourses,
  getCourseDetails,
  getStudentAssignments,
  getStudentTransactions
} from '../controllers/studentDashboardController.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware(['student']));

// Dashboard data
router.get('/dashboard', getDashboardData);

// Student courses
router.get('/courses', getStudentCourses);
router.get('/courses/:id', getCourseDetails);

// Student assignments
router.get('/assignments', getStudentAssignments);

// Student transactions
router.get('/transactions', getStudentTransactions);

export default router;
