// app.js
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import authRoutes from './routes/authRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import assignmentRoutes from './routes/assignmentRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import studentDashboardRoutes from './routes/studentDashboardRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';

import { errorHandler } from './middlewares/errorHandler.js';
import { limiter } from './middlewares/rate-limitter.js';

const app = express();

// Trust proxy (important for secure cookies & rate limiting behind reverse proxies)
app.set('trust proxy', 1);

// --- Security middleware ---
app.use(helmet());

// --- Input sanitization middleware ---
import { body, query, param } from 'express-validator';

// Global middleware to check for MongoDB operators in request body and query
app.use([
  // Sanitize request body
  body('*').trim().escape(),
  
  // Sanitize query parameters
  query('*').trim().escape(),
  
  // Sanitize URL parameters
  param('*').trim().escape(),
  
  // Remove MongoDB operators from request body and query
  (req, res, next) => {
    // Sanitize request body
    if (req.body) {
      Object.keys(req.body).forEach(key => {
        if (key.startsWith('$') || key.includes('.')) {
          delete req.body[key];
        }
      });
    }
    
    // Sanitize query parameters
    if (req.query) {
      Object.keys(req.query).forEach(key => {
        if (key.startsWith('$') || key.includes('.')) {
          delete req.query[key];
        }
      });
    }
    
    next();
  }
]);

// --- CORS configuration ---
const rawAllowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',  // Next.js dev server
  'http://localhost:3001',
  'https://localhost:3000',
  'https://localhost:3001',
].filter(Boolean);

// Normalize allowed origins (remove trailing slashes and handle www.)
const normalizeOrigin = (origin = '') => origin.replace(/\/$/, '').replace(/^https?:\/\/www\./, match => match.replace('www.', ''));

const allowedOrigins = rawAllowedOrigins.map(normalizeOrigin);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      // Allow non-browser clients like curl or SSR
      return callback(null, true);
    }
    const normalized = normalizeOrigin(origin);
    if (allowedOrigins.includes(normalized)) {
      return callback(null, true);
    }
    console.warn(`❌ Not allowed by CORS: ${origin}`);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  optionsSuccessStatus: 200, // For legacy browsers
};

app.use(cors(corsOptions));

// --- Body parsing ---
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// --- Rate limiting ---
app.use(limiter);

// --- API routes ---
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/student', studentDashboardRoutes);
app.use('/api/uploads', uploadRoutes);

// --- Health check endpoint ---
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, status: 'ok' });
});

// --- 404 handler ---
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Can't find ${req.originalUrl} on this server!`,
    path: req.path,
  });
});

// --- Global error handling middleware ---
app.use(errorHandler);

export default app;
