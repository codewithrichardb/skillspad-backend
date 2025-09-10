import connectDB from "../../lib/mongodb.js";

/**
 * Add a new lesson to a module
 */
export const addLesson = async (req, res) => {
    try {
        const { courseId, moduleId } = req.params;
        const { title, content, duration, order, type = 'video' } = req.body;

        // Basic validation
        if (!title || !content) {
            return res.status(400).json({
                success: false,
                message: 'Title and content are required for a lesson'
            });
        }

        const db = await connectDB();
        const ObjectId = (await import('mongodb')).ObjectId;

        // Check if course and module exist
        const course = await db.collection('courses').findOne(
            { 
                _id: new ObjectId(courseId),
                'modules._id': new ObjectId(moduleId) 
            },
            { projection: { 'modules.$': 1 } }
        );

        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course or module not found'
            });
        }

        const moduleData = course.modules[0];
        const newLesson = {
            _id: new ObjectId(),
            title,
            content,
            duration: parseInt(duration) || 0,
            order: order || (moduleData.lessons?.length || 0) + 1,
            type,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Add lesson to module
        const result = await db.collection('courses').updateOne(
            { 
                _id: new ObjectId(courseId),
                'modules._id': new ObjectId(moduleId) 
            },
            { 
                $push: { 'modules.$.lessons': newLesson }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Course or module not found'
            });
        }

        // Return the lesson ID in the expected format for the frontend
        return res.status(201).json({
            success: true,
            message: 'Lesson added successfully',
            data: {
                _id: newLesson._id,
                ...newLesson
            }
        });

    } catch (error) {
        console.error('Error adding lesson:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to add lesson',
            error: error.message
        });
    }
};

/**
 * Update a lesson
 */
export const updateLesson = async (req, res) => {
    try {
        const { courseId, moduleId, lessonId } = req.params;
        const { title, content, duration, order, type } = req.body;

        // Basic validation
        if (!title || !content) {
            return res.status(400).json({
                success: false,
                message: 'Title and content are required for a lesson'
            });
        }

        const db = await connectDB();
        const ObjectId = (await import('mongodb')).ObjectId;

        // Prepare update fields
        const updateFields = {
            'modules.$[module].lessons.$[lesson].title': title,
            'modules.$[module].lessons.$[lesson].content': content,
            'modules.$[module].lessons.$[lesson].updatedAt': new Date()
        };

        if (duration !== undefined) {
            updateFields['modules.$[module].lessons.$[lesson].duration'] = parseInt(duration);
        }
        if (order !== undefined) {
            updateFields['modules.$[module].lessons.$[lesson].order'] = order;
        }
        if (type) {
            updateFields['modules.$[module].lessons.$[lesson].type'] = type;
        }

        // Update lesson
        const result = await db.collection('courses').updateOne(
            { 
                _id: new ObjectId(courseId),
                'modules._id': new ObjectId(moduleId),
                'modules.lessons._id': new ObjectId(lessonId)
            },
            { 
                $set: updateFields
            },
            {
                arrayFilters: [
                    { 'module._id': new ObjectId(moduleId) },
                    { 'lesson._id': new ObjectId(lessonId) }
                ]
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Course, module, or lesson not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Lesson updated successfully'
        });

    } catch (error) {
        console.error('Error updating lesson:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update lesson',
            error: error.message
        });
    }
};

/**
 * Delete a lesson
 */
export const deleteLesson = async (req, res) => {
    try {
        const { courseId, moduleId, lessonId } = req.params;
        const db = await connectDB();
        const ObjectId = (await import('mongodb')).ObjectId;

        // Remove lesson from module
        const result = await db.collection('courses').updateOne(
            { _id: new ObjectId(courseId) },
            { 
                $pull: { 
                    'modules.$[module].lessons': { _id: new ObjectId(lessonId) } 
                } 
            },
            {
                arrayFilters: [
                    { 'module._id': new ObjectId(moduleId) }
                ]
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        if (result.modifiedCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Module or lesson not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Lesson deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting lesson:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete lesson',
            error: error.message
        });
    }
};
