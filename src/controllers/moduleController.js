import connectDB from "../../lib/mongodb.js";

/**
 * Add a new module to a course
 */
export const addModule = async (req, res) => {
    try {
        const { courseId } = req.params;
        const { title, description, order } = req.body;

        // Basic validation
        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'Module title is required'
            });
        }

        const db = await connectDB();
        const ObjectId = (await import('mongodb')).ObjectId;

        // Check if course exists
        const course = await db.collection('courses').findOne({ _id: new ObjectId(courseId) });
        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        // Create new module
        const newModule = {
            _id: new ObjectId(),
            title,
            description: description || '',
            order: order || (course.modules?.length || 0) + 1,
            lessons: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Add module to course
        const result = await db.collection('courses').updateOne(
            { _id: new ObjectId(courseId) },
            { $push: { modules: newModule } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        // Return the module ID in the expected format for the frontend
        return res.status(201).json({
            success: true,
            message: 'Module added successfully',
            data: {
                _id: newModule._id,
                ...newModule
            }
        });

    } catch (error) {
        console.error('Error adding module:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to add module',
            error: error.message
        });
    }
};

/**
 * Update a module
 */
export const updateModule = async (req, res) => {
    try {
        const { courseId, moduleId } = req.params;
        const { title, description, order } = req.body;

        // Basic validation
        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'Module title is required'
            });
        }

        const db = await connectDB();
        const ObjectId = (await import('mongodb')).ObjectId;

        // Find the course and module
        const course = await db.collection('courses').findOne(
            { _id: new ObjectId(courseId) },
            { projection: { 'modules._id': 1 } }
        );

        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        // Check if module exists
        const moduleExists = course.modules?.some(m => m._id.toString() === moduleId);
        if (!moduleExists) {
            return res.status(404).json({
                success: false,
                message: 'Module not found'
            });
        }

        // Update module
        const updateFields = {
            'modules.$.title': title,
            'modules.$.description': description || '',
            'modules.$.updatedAt': new Date()
        };

        if (order !== undefined) {
            updateFields['modules.$.order'] = order;
        }

        const result = await db.collection('courses').updateOne(
            { _id: new ObjectId(courseId), 'modules._id': new ObjectId(moduleId) },
            { $set: updateFields }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Module not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Module updated successfully'
        });

    } catch (error) {
        console.error('Error updating module:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update module',
            error: error.message
        });
    }
};

/**
 * Delete a module
 */
export const deleteModule = async (req, res) => {
    try {
        const { courseId, moduleId } = req.params;
        const db = await connectDB();
        const ObjectId = (await import('mongodb')).ObjectId;

        // Delete module from course
        const result = await db.collection('courses').updateOne(
            { _id: new ObjectId(courseId) },
            { $pull: { modules: { _id: new ObjectId(moduleId) } } }
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
                message: 'Module not found or already deleted'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Module deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting module:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete module',
            error: error.message
        });
    }
};
