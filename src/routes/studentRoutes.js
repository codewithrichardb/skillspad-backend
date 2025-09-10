import express from 'express';
import { 
  getStudents, 
  updateStudent, 
  deleteStudent 
} from '../controllers/studentController.js';
import { authMiddleware } from '../middlewares/auth.js';
import { ObjectId } from 'mongodb';

const router = express.Router();

// Apply auth middleware to all routes with admin role requirement
router.use(authMiddleware(['admin']));

// Convert string IDs to ObjectId for MongoDB
const convertToObjectId = (req, res, next) => {
  if (req.params.id && !ObjectId.isValid(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid student ID format'
    });
  }
  
  if (req.params.id) {
    req.params.id = new ObjectId(req.params.id);
  }
  
  next();
};

// Get all students (admin only)
router.get('/', getStudents);

// Student management routes (admin only)
router.route('/:id')
  .all(convertToObjectId)
  .put(updateStudent)     // Update student details
  .delete(deleteStudent); // Deactivate/delete student account

export default router;
