import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/authRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import assignmentRoutes from './routes/assignmentRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { limiter } from './middlewares/rate-limitter.js';
import connectDB from '../lib/mongodb.js';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 4000;

// Trust first proxy (important for rate limiting behind reverse proxy like nginx)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet()); // Set various HTTP headers for security
app.use(mongoSanitize()); // Sanitize user-supplied data to prevent MongoDB Operator Injection

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // Allow cookies to be sent cross-origin
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10kb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: '10kb' })); // Parse URL-encoded bodies
app.use(cookieParser()); // Parse cookies


// API routes with rate limiting
app.use('/api/auth', limiter, authRoutes);
app.use('/api/payments', limiter, paymentRoutes);
app.use('/api/courses', limiter, courseRoutes);
app.use('/api/assignments', limiter, assignmentRoutes);
app.use('/api/students', limiter, studentRoutes);
app.use('/api/upload', limiter, uploadRoutes);

// Serve static files from uploads directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Admin routes (backward compatibility)
app.use('/api/admin/courses', limiter, courseRoutes);
app.use('/api/admin/assignments', limiter, assignmentRoutes);
app.use('/api/admin/students', limiter, studentRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler - match any route that hasn't been matched yet
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Can't find ${req.originalUrl} on this server!`,
    path: req.path
  });
});

// Error handling middleware
app.use(errorHandler);

// Initialize MongoDB connection and start server
const startServer = async () => {
  let server;
  
  try {
    // Initialize MongoDB connection
    await connectDB();
    
    // Start server
    server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      console.error('Unhandled Rejection:', err);
      if (server) {
        server.close(() => process.exit(1));
      } else {
        process.exit(1);
      }
    });
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      console.error('UNCAUGHT EXCEPTION! Shutting down...');
      console.error(err);
      if (server) {
        server.close(() => process.exit(1));
      } else {
        process.exit(1);
      }
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    if (server) {
      server.close(() => process.exit(1));
    } else {
      process.exit(1);
    }
  }
};

// Start the server
startServer();

export default app;
