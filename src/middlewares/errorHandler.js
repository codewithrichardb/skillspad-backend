/**
 * Global error handling middleware
 * Handles different types of errors and sends appropriate responses
 */
const errorHandler = (err, req, res, next) => {
  // Default error status and message
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = err.errors;

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400; // Bad Request
    message = 'Validation Error';
    errors = {};
    
    // Format Mongoose validation errors
    for (const field in err.errors) {
      errors[field] = err.errors[field].message;
    }
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401; // Unauthorized
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401; // Unauthorized
    message = 'Token expired';
  } else if (err.code === 11000) {
    // Handle duplicate key error (MongoDB)
    statusCode = 409; // Conflict
    const field = Object.keys(err.keyValue)[0];
    message = `${field} already exists`;
  }

  // Log error in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', {
      message: err.message,
      stack: err.stack,
      name: err.name,
      status: statusCode
    });
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

export { errorHandler };

// Helper function to create custom error objects
export const createError = (statusCode, message, errors = null) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (errors) error.errors = errors;
  return error;
};

// 404 Not Found handler
export const notFound = (req, res, next) => {
  const error = createError(404, `Not Found - ${req.originalUrl}`);
  next(error);
};
