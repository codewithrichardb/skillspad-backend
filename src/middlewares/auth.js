import jwt from 'jsonwebtoken';
import connectDB from '../../lib/mongodb.js';

/**
 * Middleware to authenticate requests using JWT
 * Supports both Authorization header and cookies
 * @param {Array} roles - Array of allowed roles (empty array allows any authenticated user)
 */
export const authMiddleware = (roles = []) => {
    return async (req, res, next) => {
        try {
            // Get token from header or cookie
            let token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;
            
            if (!token) {
                return res.status(401).json({
                    success: false,
                    message: 'Access denied. No token provided.'
                });
            }

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Check if user exists in database
            const db = await connectDB();
            const user = await db.collection('users').findOne({ _id: decoded.userId });
            
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'User not found. Please log in again.'
                });
            }
            
            // Check if user has required role
            if (roles.length && !roles.includes(user.role)) {
                return res.status(403).json({
                    success: false,
                    message: 'You do not have permission to access this resource.'
                });
            }

            // Add user to request object
            req.user = user;
            next();
        } catch (error) {
            console.error('Authentication error:', error);
            
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    message: 'Session expired. Please log in again.'
                });
            }
            
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token.'
            });
        }
    };
};

/**
 * Middleware to check if user is authenticated (for optional auth routes)
 */
export const optionalAuth = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
        }
        next();
    } catch (error) {
        // If token is invalid, just continue without setting req.user
        next();
    }
};

/**
 * Check if user has required roles
 */
export const hasRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required.'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions.'
            });
        }

        next();
    };
};
