import { ObjectId } from 'mongodb';
import { getDB } from '../../lib/mongodb.js';
import bcrypt from 'bcrypt';

// Helper function to sanitize student data (remove sensitive fields)
const sanitizeStudent = ({ password, ...student }) => student;

// @desc    Get all students (admin only)
// @route   GET /api/admin/students
// @access  Private/Admin
export const getStudents = async (req, res) => {
  try {
    const db = await getDB();
    const { page = 1, limit = 10, q = '', sortField = 'name', sortOrder = 'asc' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    const query = { role: 'student' };
    
    if (q) {
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ];
    }

    // Get total count
    const total = await db.collection('users').countDocuments(query);
    
    // Get paginated results
    const sort = {};
    sort[sortField] = sortOrder === 'asc' ? 1 : -1;
    
    const students = await db.collection('users')
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    // Remove sensitive data
    const sanitizedStudents = students.map(({ password, ...student }) => student);

    return res.status(200).json({
      success: true,
      data: {
        students: sanitizedStudents,
        totalStudents: total
      }
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch students',
      error: error.message
    });
  }
};

// @desc    Update student details (admin only)
// @route   PUT /api/admin/students/:id
// @access  Private/Admin

export const updateStudent = async (req, res) => {
  try {
    const db = await getDB();
    const { id } = req.params;
    const { name, email, password, status } = req.body;

    // Validate ID
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid student ID'
      });
    }

    // Check if student exists
    const existingStudent = await db.collection('users').findOne({ 
      _id: new ObjectId(id),
      role: 'student'
    });

    if (!existingStudent) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Prevent changing email to one that's already in use
    if (email && email !== existingStudent.email) {
      const emailExists = await db.collection('users').findOne({ 
        email,
        _id: { $ne: new ObjectId(id) }
      });

      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use by another user'
        });
      }
    }

    // Check if email is being updated and already exists
    if (email && email !== existingStudent.email) {
      const emailExists = await db.collection('users').findOne({ 
        email,
        _id: { $ne: new ObjectId(id) }
      });

      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use by another user'
        });
      }
    }

    // Prepare update data
    const updateData = {
      name: name || existingStudent.name,
      email: email || existingStudent.email,
      status: status || existingStudent.status,
      updatedAt: new Date()
    };

    // Update password if provided
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    // Update student
    await db.collection('users').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    // Get updated student data without password
    const updatedStudent = await db.collection('users').findOne(
      { _id: new ObjectId(id) },
      { projection: { password: 0 } }
    );

    return res.status(200).json({
      success: true,
      message: 'Student updated successfully',
      data: updatedStudent
    });
  } catch (error) {
    console.error('Error updating student:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update student',
      error: error.message
    });
  }
};

// @desc    Deactivate/delete student account (admin only)
// @route   DELETE /api/admin/students/:id
// @access  Private/Admin
export const deleteStudent = async (req, res) => {
  try {
    const db = await getDB();
    const { id } = req.params;

    // Validate ID
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid student ID'
      });
    }

    // Check if student exists
    const student = await db.collection('users').findOne({ 
      _id: new ObjectId(id),
      role: 'student'
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Instead of deleting, we'll deactivate the account
    await db.collection('users').updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          status: 'inactive',
          updatedAt: new Date()
        } 
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Student account deactivated successfully'
    });
  } catch (error) {
    console.error('Error deleting student:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete student',
      error: error.message
    });
  }
};
