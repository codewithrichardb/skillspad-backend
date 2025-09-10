import express from 'express';
import { handleFileUpload } from '../utils/fileUpload.js';
import { authMiddleware } from '../middlewares/auth.js';
import path from 'path';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware(['admin', 'instructor']));

// File upload endpoint
router.post('/', handleFileUpload, (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    // Construct the file URL
    const fileUrl = `/uploads/${req.file.filename}`;

    res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: fileUrl,
      },
    });
  } catch (error) {
    console.error('Error handling file upload:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing file upload',
      error: error.message,
    });
  }
});

export default router;
