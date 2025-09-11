import express from 'express';
import { 
  createAssignment, 
  getAssignments, 
  getAssignmentById, 
  updateAssignment, 
  deleteAssignment,
  deleteAttachment 
} from '../controllers/assignmentController.js';
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
      message: 'Invalid assignment ID format'
    });
  }
  
  if (req.params.id) {
    req.params.id = new ObjectId(req.params.id);
  }
  
  // Create a new object for converted query params
  const convertedQuery = { ...req.query };
  
  // Convert courseId and moduleId in query params if they exist
  if (req.query.courseId && ObjectId.isValid(req.query.courseId)) {
    convertedQuery.courseId = new ObjectId(req.query.courseId);
  }
  
  if (req.query.moduleId && ObjectId.isValid(req.query.moduleId)) {
    convertedQuery.moduleId = new ObjectId(req.query.moduleId);
  }
  
  // Attach converted query to request object
  req.convertedQuery = convertedQuery;
  
  next();
};

// Assignment routes
router.post('/', createAssignment);
router.get('/', getAssignments);

// Routes that require an ID parameter
router.route('/:id')
  .all(convertToObjectId)
  .get(getAssignmentById)
  .put(updateAssignment)
  .delete(deleteAssignment);

// Route for deleting attachments
router.delete('/attachments/:publicId', deleteAttachment);

// Additional admin routes
router.get('/course/:courseId', async (req, res) => {
  // This will be implemented to get assignments by course
  // For now, it's a placeholder
  res.status(200).json({ success: true, data: [] });
});

router.get('/module/:moduleId', async (req, res) => {
  // This will be implemented to get assignments by module
  // For now, it's a placeholder
  res.status(200).json({ success: true, data: [] });
});

export default router;
