import * as Yup from 'yup';

// Validation schema for a module
export const moduleSchema = Yup.object().shape({
  title: Yup.string().required('Module title is required'),
  description: Yup.string(),
  order: Yup.number().min(1, 'Order must be at least 1').integer('Order must be an integer'),
  duration: Yup.number().min(0, 'Duration cannot be negative').integer('Duration must be an integer')
});

// Validation schema for a lesson
export const lessonSchema = Yup.object().shape({
  title: Yup.string().required('Lesson title is required'),
  content: Yup.string().required('Lesson content is required'),
  duration: Yup.number().min(0, 'Duration cannot be negative').integer('Duration must be an integer'),
  order: Yup.number().min(1, 'Order must be at least 1').integer('Order must be an integer'),
  type: Yup.string().oneOf(['video', 'text', 'quiz'], 'Invalid lesson type')
});

// Middleware to validate module data
export const validateModule = (req, res, next) => {
  const moduleData = req.body;
  
  moduleSchema.validate(moduleData, { abortEarly: false })
    .then(() => next())
    .catch(error => {
      const errors = error.inner.map(err => ({
        field: err.path,
        message: err.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    });
};

// Middleware to validate lesson data
export const validateLesson = (req, res, next) => {
  const lessonData = req.body;
  
  lessonSchema.validate(lessonData, { abortEarly: false })
    .then(() => next())
    .catch(error => {
      const errors = error.inner.map(err => ({
        field: err.path,
        message: err.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    });
};
