import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Create Cloudinary storage engine
const storage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => ({
    folder: 'assignments',
    allowed_formats: ['pdf', 'doc', 'docx', 'txt', 'zip', 'rar'],
    resource_type: 'auto',
    public_id: `assignment_${Date.now()}_${Math.round(Math.random() * 1e9)}`,
  }),
});

// File filter for allowed types
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/zip',
    'application/x-rar-compressed',
    'application/x-zip-compressed',
    'multipart/x-zip',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, DOCX, TXT, ZIP, and RAR files are allowed.'), false);
  }
};

// Initialize multer with Cloudinary storage
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit (Cloudinary's free tier limit is 20MB)
  },
});

// Middleware for handling file uploads
const uploadFile = upload.single('file');

// Middleware wrapper for async/await
const handleFileUpload = (req, res, next) => {
  uploadFile(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size exceeds the 20MB limit',
        });
      }
      if (err.message.includes('Invalid file type')) {
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Error uploading file',
        error: err.message,
      });
    }
    next();
  });
};

// Delete file from Cloudinary
const deleteFile = async (publicId) => {
  try {
    if (!publicId) return true;
    
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === 'ok';
  } catch (error) {
    console.error('Error deleting file from Cloudinary:', error);
    return false;
  }
};

// Extract public ID from Cloudinary URL
const getPublicId = (url) => {
  if (!url) return null;
  const matches = url.match(/upload\/(?:v\d+\/)?([^\/]+)/);
  return matches ? matches[1].split('.')[0] : null;
};

export { 
  handleFileUpload, 
  deleteFile, 
  getPublicId,
  cloudinary 
};
