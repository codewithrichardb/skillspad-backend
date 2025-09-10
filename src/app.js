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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Trust proxy for production
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());
app.use(mongoSanitize());

// Rate limiting
app.use(limiter);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/uploads', uploadRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../../frontend');
  const nextStaticPath = path.join(frontendPath, '.next/static');
  const publicPath = path.join(frontendPath, 'public');

  // Serve static files from .next/static
  app.use('/_next/static', express.static(path.join(nextStaticPath, 'static'), {
    maxAge: '1y',
    immutable: true
  }));

  // Serve public folder
  app.use(express.static(publicPath, {
    maxAge: '1d'
  }));

  // Handle Next.js routes
  const handle = (req, res) => {
    const parsedUrl = new URL(req.url, 'http://localhost');
    const { pathname } = parsedUrl;
    
    // Handle API routes
    if (pathname.startsWith('/api/')) {
      return res.status(404).json({ message: 'API route not found' });
    }

    // Handle static files
    if (pathname.startsWith('/_next/')) {
      return res.status(404).send('Not found');
    }

    // Handle all other routes with Next.js
    return res.sendFile(path.join(frontendPath, '.next/server/pages/index.html'));
  };

  app.get('*', handle);
  app.post('*', handle);
}

// 404 handler - must be after all other routes
app.use((req, res) => {
  res.status(404).json({
    status: 'fail',
    message: `Can't find ${req.originalUrl} on this server!`,
    path: req.path
  });
});

// Error handling middleware
app.use(errorHandler);

export { app, connectDB };
