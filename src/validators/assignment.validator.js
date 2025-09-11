import { body, param, validationResult } from 'express-validator';
import { ObjectId } from 'mongodb';

// Common validation rules
export const assignmentValidationRules = {
  title: body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ min: 3, max: 100 }).withMessage('Title must be between 3 and 100 characters'),
    
  description: body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),
    
  instructions: body('instructions')
    .optional()
    .trim(),
    
  courseId: body('courseId')
    .notEmpty().withMessage('Course ID is required')
    .custom((value) => ObjectId.isValid(value)).withMessage('Invalid course ID format'),
    
  moduleId: body('moduleId')
    .notEmpty().withMessage('Module ID is required')
    .custom((value) => ObjectId.isValid(value)).withMessage('Invalid module ID format'),
    
  dueDate: body('dueDate')
    .notEmpty().withMessage('Due date is required')
    .isISO8601().withMessage('Invalid date format. Use ISO8601 format (e.g., YYYY-MM-DD)'),
    
  points: body('points')
    .optional()
    .isInt({ min: 0 }).withMessage('Points must be a positive integer'),
    
  submissionType: body('submissionType')
    .isIn(['text', 'file', 'both']).withMessage('Invalid submission type')
};

// Validation middleware
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  
  const extractedErrors = [];
  errors.array().map(err => extractedErrors.push({ [err.path]: err.msg }));
  
  return res.status(422).json({
    success: false,
    message: 'Validation failed',
    errors: extractedErrors
  });
};

// Specific validation chains
export const createAssignmentRules = [
  assignmentValidationRules.title,
  assignmentValidationRules.description,
  assignmentValidationRules.instructions,
  assignmentValidationRules.courseId,
  assignmentValidationRules.moduleId,
  assignmentValidationRules.dueDate,
  assignmentValidationRules.points,
  assignmentValidationRules.submissionType,
  validate
];

export const updateAssignmentRules = [
  param('id')
    .custom((value) => ObjectId.isValid(value)).withMessage('Invalid assignment ID format'),
  assignmentValidationRules.title.optional(),
  assignmentValidationRules.description,
  assignmentValidationRules.instructions,
  assignmentValidationRules.courseId.optional(),
  assignmentValidationRules.moduleId.optional(),
  assignmentValidationRules.dueDate.optional(),
  assignmentValidationRules.points,
  assignmentValidationRules.submissionType.optional(),
  validate
];

export const getAssignmentRules = [
  param('id')
    .custom((value) => ObjectId.isValid(value)).withMessage('Invalid assignment ID format'),
  validate
];
