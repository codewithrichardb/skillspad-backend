import connectDB from "../../lib/mongodb.js";
import { getPublicId } from '../utils/fileUpload.js';

// @desc    Create a new assignment
// @route   POST /api/assignments
// @access  Private/Admin
const createAssignment = async (req, res) => {
    try {
        const { 
            title, 
            description, 
            instructions,
            courseId,
            moduleId,
            dueDate,
            points,
            submissionType,
            attachments = []
        } = req.body;

        // Basic validation
        if (!title || !courseId || !moduleId || !dueDate) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        const db = await connectDB();
        const assignments = db.collection('assignments');
        
        // Check if assignment with same title in the same module already exists
        const existingAssignment = await assignments.findOne({ 
            title,
            courseId,
            moduleId
        });

        if (existingAssignment) {
            return res.status(400).json({
                success: false,
                message: 'An assignment with this title already exists in this module'
            });
        }

        // Create new assignment
        const newAssignment = {
            title,
            description: description || '',
            instructions: instructions || '',
            courseId,
            moduleId,
            dueDate: new Date(dueDate),
            points: points || 100,
            submissionType: submissionType || 'text',
            attachments,
            status: 'draft',
            createdBy: req.user._id,
            createdAt: new Date(),
            updatedAt: new Date(),
            submissions: 0
        };

        const result = await assignments.insertOne(newAssignment);

        return res.status(201).json({
            success: true,
            message: 'Assignment created successfully',
            data: {
                _id: result.insertedId,
                ...newAssignment
            }
        });
    } catch (error) {
        console.error('Error creating assignment:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create assignment',
            error: error.message
        });
    }
};

// @desc    Get all assignments
// @route   GET /api/assignments
// @access  Private/Admin
const getAssignments = async (req, res) => {
    try {
        const db = await connectDB();
        
        // Build match stage for filtering
        const matchStage = {};
        if (req.convertedQuery.courseId) {
            matchStage.courseId = req.convertedQuery.courseId;
        }
        if (req.convertedQuery.moduleId) {
            matchStage.moduleId = req.convertedQuery.moduleId;
        }
        
        // Create pipeline
        const pipeline = [];
        
        // Add match stage if we have filters
        if (Object.keys(matchStage).length > 0) {
            pipeline.push({ $match: matchStage });
        }
        
        // Add lookup and project stages
        pipeline.push(
            {
                $lookup: {
                    from: 'courses',
                    localField: 'courseId',
                    foreignField: '_id',
                    as: 'course'
                }
            },
            { $unwind: '$course' },
            {
                $lookup: {
                    from: 'modules',
                    localField: 'moduleId',
                    foreignField: '_id',
                    as: 'module'
                }
            },
            { $unwind: '$module' },
            {
                $project: {
                    title: 1,
                    description: 1,
                    status: 1,
                    dueDate: 1,
                    points: 1,
                    submissions: 1,
                    courseId: 1,
                    moduleId: 1,
                    'course.title': 1,
                    'module.title': 1,
                    createdAt: 1,
                    updatedAt: 1
                }
            }
        );
        
        // Execute aggregation
        const assignments = await db.collection('assignments').aggregate(pipeline).toArray();
        
        return res.status(200).json({
            success: true,
            data: assignments
        });
    } catch (error) {
        console.error('Error fetching assignments:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch assignments',
            error: error.message
        });
    }
};

// @desc    Get single assignment
// @route   GET /api/assignments/:id
// @access  Private/Admin
const getAssignmentById = async (req, res) => {
    try {
        const { id } = req.params;
        const db = await connectDB();
        
        const assignment = await db.collection('assignments').findOne({ _id: id });
        
        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found'
            });
        }
        
        return res.status(200).json({
            success: true,
            data: assignment
        });
    } catch (error) {
        console.error('Error fetching assignment:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch assignment',
            error: error.message
        });
    }
};

// @desc    Update assignment
// @route   PUT /api/assignments/:id
// @access  Private/Admin
const updateAssignment = async (req, res) => {
    const session = await connectDB().startSession();
    session.startTransaction();
    
    try {
        const { id } = req.params;
        const updateData = { ...req.body, updatedAt: new Date() };
        
        const db = req.db || (await connectDB());
        
        // Check if assignment exists
        const existingAssignment = await db.collection('assignments').findOne({ _id: id });
        if (!existingAssignment) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: 'Assignment not found'
            });
        }
        
        // Handle file deletions if attachments are being updated
        if (updateData.attachments && Array.isArray(updateData.attachments)) {
            // Find attachments that were removed
            const removedAttachments = existingAssignment.attachments.filter(
                existing => !updateData.attachments.some(updated => 
                    updated.url === existing.url ||
                    (existing.publicId && updated.publicId === existing.publicId)
                )
            );
            
            // Delete removed attachments from Cloudinary
            for (const attachment of removedAttachments) {
                const publicId = attachment.publicId || getPublicId(attachment.url);
                if (publicId) {
                    try {
                        await cloudinary.uploader.destroy(publicId);
                    } catch (error) {
                        console.error('Error deleting file from Cloudinary:', error);
                        // Continue with other deletions even if one fails
                    }
                }
            }
        }
        
        // Prevent changing courseId and moduleId if submissions exist
        if (existingAssignment.submissions > 0) {
            if (updateData.courseId && updateData.courseId !== existingAssignment.courseId) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    message: 'Cannot change course after submissions have been made'
                });
            }
            
            if (updateData.moduleId && updateData.moduleId !== existingAssignment.moduleId) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot change module after submissions have been made'
                });
            }
        }
        
        const result = await db.collection('assignments').updateOne(
            { _id: id },
            { $set: updateData }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found'
            });
        }
        
        return res.status(200).json({
            success: true,
            message: 'Assignment updated successfully'
        });
    } catch (error) {
        console.error('Error updating assignment:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update assignment',
            error: error.message
        });
    }
};

// @desc    Delete assignment
// @route   DELETE /api/assignments/:id
// @access  Private/Admin
const deleteAssignment = async (req, res) => {
    const session = await connectDB().startSession();
    session.startTransaction();
    
    try {
        const { id } = req.params;
        const db = req.db || (await connectDB());
        
        // Check if assignment exists
        const assignment = await db.collection('assignments').findOne({ _id: id });
        if (!assignment) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: 'Assignment not found'
            });
        }
        
        // Check if there are submissions
        if (assignment.submissions > 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Cannot delete assignment with existing submissions'
            });
        }
        
        // Delete all attached files from Cloudinary
        if (assignment.attachments && assignment.attachments.length > 0) {
            for (const attachment of assignment.attachments) {
                const publicId = attachment.publicId || getPublicId(attachment.url);
                if (publicId) {
                    try {
                        await cloudinary.uploader.destroy(publicId);
                    } catch (error) {
                        console.error('Error deleting file from Cloudinary:', error);
                        // Continue with other deletions even if one fails
                    }
                }
            }
        }
        
        // Delete the assignment
        await db.collection('assignments').deleteOne({ _id: id }, { session });
        
        await session.commitTransaction();
        session.endSession();
        
        return res.status(200).json({
            success: true,
            message: 'Assignment deleted successfully'
        });
        
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error deleting assignment:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete assignment',
            error: error.message
        });
    }
};

// Add cloudinary to exports
import { v2 as cloudinary } from 'cloudinary';

// @desc    Delete an attachment from Cloudinary
// @route   DELETE /api/assignments/attachments/:publicId
// @access  Private/Admin
const deleteAttachment = async (req, res) => {
  try {
    const { publicId } = req.params;
    
    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: 'Public ID is required'
      });
    }
    
    // Delete from Cloudinary
    const result = await cloudinary.uploader.destroy(publicId);
    
    if (result.result !== 'ok') {
      throw new Error('Failed to delete file from Cloudinary');
    }
    
    return res.status(200).json({
      success: true,
      message: 'Attachment deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting attachment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete attachment',
      error: error.message
    });
  }
};

export {
    createAssignment,
    getAssignments,
    getAssignmentById,
    updateAssignment,
    deleteAssignment,
    deleteAttachment,
    cloudinary
};
