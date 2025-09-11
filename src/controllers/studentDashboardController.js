import { ObjectId } from 'mongodb';
import connectDB from '../../lib/mongodb.js';

export const getDashboardData = async (req, res) => {
  try {
    const db = await connectDB();
    const userId = req.user.userId;

    // Get user data
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { password: 0 } } // Exclude password
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get enrolled courses
    const courses = await db.collection('courses')
      .find({ _id: { $in: user.enrolledCourses || [] } })
      .toArray();

    // Get assignments for enrolled courses
    const assignments = await db.collection('assignments')
      .find({ 
        courseId: { $in: courses.map(c => c._id) },
        dueDate: { $gte: new Date() } // Only upcoming assignments
      })
      .sort({ dueDate: 1 })
      .limit(5) // Limit to 5 upcoming assignments
      .toArray();

    // Get payment transactions
    const transactions = await db.collection('transactions')
      .find({ userId: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(5) // Last 5 transactions
      .toArray();

    return res.status(200).json({
      success: true,
      data: {
        user,
        courses,
        assignments,
        transactions
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load dashboard data',
      error: error.message
    });
  }
};

export const getStudentCourses = async (req, res) => {
  try {
    const db = await connectDB();
    const userId = req.user.userId;

    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { enrolledCourses: 1 } }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const courses = await db.collection('courses')
      .find({ _id: { $in: user.enrolledCourses || [] } })
      .toArray();

    return res.status(200).json({
      success: true,
      data: courses
    });

  } catch (error) {
    console.error('Get courses error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch courses',
      error: error.message
    });
  }
};

export const getCourseDetails = async (req, res) => {
  try {
    const db = await connectDB();
    const { id } = req.params;
    const userId = req.user.userId;

    // Verify user is enrolled in the course
    const user = await db.collection('users').findOne({
      _id: new ObjectId(userId),
      enrolledCourses: new ObjectId(id)
    });

    if (!user) {
      return res.status(403).json({
        success: false,
        message: 'Not enrolled in this course'
      });
    }

    const course = await db.collection('courses').findOne({ _id: new ObjectId(id) });
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Get course modules and lessons
    const modules = await db.collection('modules')
      .find({ courseId: new ObjectId(id) })
      .sort({ order: 1 })
      .toArray();

    // Get user's progress
    const progress = await db.collection('userProgress').findOne({
      userId: new ObjectId(userId),
      courseId: new ObjectId(id)
    });

    return res.status(200).json({
      success: true,
      data: {
        ...course,
        modules,
        progress: progress || { completedLessons: [], lastAccessed: null }
      }
    });

  } catch (error) {
    console.error('Course details error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch course details',
      error: error.message
    });
  }
};

export const getStudentAssignments = async (req, res) => {
  try {
    const db = await connectDB();
    const userId = req.user.userId;
    const { status } = req.query; // 'pending', 'submitted', 'graded'

    // Get user's enrolled courses
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { enrolledCourses: 1 } }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const query = { 
      courseId: { $in: user.enrolledCourses || [] }
    };

    // Filter by status if provided
    if (status === 'pending') {
      query.dueDate = { $gte: new Date() };
      query.submissions = { $not: { $elemMatch: { userId: new ObjectId(userId) } } };
    } else if (status === 'submitted') {
      query['submissions.userId'] = new ObjectId(userId);
      query['submissions.graded'] = false;
    } else if (status === 'graded') {
      query['submissions'] = {
        $elemMatch: { 
          userId: new ObjectId(userId),
          graded: true
        }
      };
    }

    const assignments = await db.collection('assignments')
      .find(query)
      .sort({ dueDate: 1 })
      .toArray();

    // Add submission status to each assignment
    const assignmentsWithStatus = assignments.map(assignment => {
      const submission = assignment.submissions?.find(
        s => s.userId.toString() === userId
      );
      
      return {
        ...assignment,
        submissionStatus: submission 
          ? (submission.graded ? 'graded' : 'submitted')
          : 'pending'
      };
    });

    return res.status(200).json({
      success: true,
      data: assignmentsWithStatus
    });

  } catch (error) {
    console.error('Get assignments error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch assignments',
      error: error.message
    });
  }
};

export const getStudentTransactions = async (req, res) => {
  try {
    const db = await connectDB();
    const userId = req.user.userId;
    const { status, limit = 10, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { userId: new ObjectId(userId) };
    
    if (status) {
      query.status = status;
    }

    const [transactions, total] = await Promise.all([
      db.collection('transactions')
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .toArray(),
      db.collection('transactions').countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      data: {
        transactions,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: error.message
    });
  }
};
