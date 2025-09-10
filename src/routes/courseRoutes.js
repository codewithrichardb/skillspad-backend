import express from 'express';
import { 
  createCourse, 
  getCourses, 
  getCourseById, 
  updateCourse, 
  deleteCourse 
} from '../controllers/courseController.js';
import { 
  addModule, 
  updateModule, 
  deleteModule 
} from '../controllers/moduleController.js';
import { 
  addLesson, 
  updateLesson, 
  deleteLesson 
} from '../controllers/lessonController.js';
import { authMiddleware } from '../middlewares/auth.js';
import { validateModule, validateLesson } from '../middlewares/validation.js';

const router = express.Router();

// Apply auth middleware to all routes with admin role requirement
router.use(authMiddleware(['admin']));

// Course routes
router.post('/', createCourse);
router.get('/', getCourses);
router.route('/:id')
  .get(getCourseById)
  .put(updateCourse)
  .delete(deleteCourse);

// Module routes
router.post('/:courseId/modules', validateModule, addModule);
router.route('/:courseId/modules/:moduleId')
  .put(validateModule, updateModule)
  .delete(deleteModule);

// Lesson routes
router.post('/:courseId/modules/:moduleId/lessons', validateLesson, addLesson);
router.route('/:courseId/modules/:moduleId/lessons/:lessonId')
  .put(validateLesson, updateLesson)
  .delete(deleteLesson);

// Export the router
export default router;
