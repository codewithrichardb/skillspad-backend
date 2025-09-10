import connectDB from "../../lib/mongodb.js";


// @ts-check
export const createCourse = async (req, res) => {
    try {
        const { title, description, price, status, imageUrl, modules } = req.body;
        
        // Basic validation
        if (!title || !description || price === undefined || !status) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        const db = await connectDB();
        const courses = db.collection('courses');
        
        // Check if course with same title already exists
        const existingCourse = await courses.findOne({ title });
        if (existingCourse) {
            return res.status(400).json({
                success: false,
                message: 'A course with this title already exists'
            });
        }

        // Create new course
        const newCourse = {
            title,
            description,
            price: parseFloat(price),
            status,
            imageUrl: imageUrl || '',
            modules: modules || [],
            createdBy: req.user._id,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await courses.insertOne(newCourse);

        // Return the course ID in the expected format for the frontend
        return res.status(201).json({
            success: true,
            message: 'Course created successfully',
            data: {
                _id: result.insertedId,
                courseId: result.insertedId.toString()
            }
        });

    } catch (error) {
        console.error('Error creating course:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create course',
            error: error.message
        });
    }
};

export const getCourses = async (req, res) => {
    try {
        const db = await connectDB();
        
        // Get all courses with additional data
        const courses = await db.collection('courses').aggregate([
            {
                $lookup: {
                    from: 'enrollments',
                    localField: '_id',
                    foreignField: 'courseId',
                    as: 'enrollments'
                }
            },
            {
                $addFields: {
                    enrolledStudents: { $size: '$enrollments' },
                    moduleCount: { $size: { $ifNull: ['$modules', []] } },
                    lessonCount: {
                        $reduce: {
                            input: { $ifNull: ['$modules', []] },
                            initialValue: 0,
                            in: { $add: ['$$value', { $size: { $ifNull: ['$$this.lessons', []] } }] }
                        }
                    }
                }
            },
            {
                $project: {
                    enrollments: 0 // Remove the enrollments array from the result
                }
            }
        ]).toArray();
        
        return res.status(200).json({
            success: true,
            data: courses
        });
    } catch (error) {
        console.error('Error fetching courses:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch courses',
            error: error.message
        });
    }
};

export const getCourseById = async (req, res) => {
    try {
        const { id } = req.params;
        const db = await connectDB();
        
        // Convert string ID to ObjectId
        const ObjectId = (await import('mongodb')).ObjectId;
        const course = await db.collection('courses').findOne({ _id: new ObjectId(id) });
        
        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }
        
        return res.status(200).json({
            success: true,
            data: course
        });
    } catch (error) {
        console.error('Error fetching course:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch course',
            error: error.message
        });
    }
};

export const updateCourse = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, price, status, imageUrl, modules } = req.body;
        
        // Basic validation
        if (!title || !description || price === undefined || !status) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        const db = await connectDB();
        const ObjectId = (await import('mongodb')).ObjectId;
        
        // Check if course exists
        const existingCourse = await db.collection('courses').findOne({ _id: new ObjectId(id) });
        if (!existingCourse) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        // Update course
        const updatedCourse = {
            title,
            description,
            price: parseFloat(price),
            status,
            imageUrl: imageUrl || existingCourse.imageUrl,
            modules: modules || existingCourse.modules,
            updatedAt: new Date()
        };

        const result = await db.collection('courses').updateOne(
            { _id: new ObjectId(id) },
            { $set: updatedCourse }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Course updated successfully',
            data: { ...updatedCourse, _id: id }
        });

    } catch (error) {
        console.error('Error updating course:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update course',
            error: error.message
        });
    }
};

export const deleteCourse = async (req, res) => {
    try {
        const { id } = req.params;
        const db = await connectDB();
        const ObjectId = (await import('mongodb')).ObjectId;

        const result = await db.collection('courses').deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Course deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting course:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete course',
            error: error.message
        });
    }
};
