import request from 'supertest';
import { app } from '../src/server.js';
import { connectDB } from '../src/lib/mongodb.js';
import jwt from 'jsonwebtoken';

describe('Course API', () => {
    let adminToken;
    let testCourseId;

    beforeAll(async () => {
        // Connect to test database
        await connectDB();

        // Create a test admin user and get token
        const db = await connectDB();
        await db.collection('users').deleteMany({ email: 'testadmin@example.com' });
        
        const hashedPassword = await bcrypt.hash('testpass123', 10);
        const adminUser = await db.collection('users').insertOne({
            email: 'testadmin@example.com',
            password: hashedPassword,
            role: 'admin',
            firstName: 'Test',
            lastName: 'Admin',
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Generate JWT token
        adminToken = jwt.sign(
            { 
                email: 'testadmin@example.com',
                role: 'admin',
                userId: adminUser.insertedId
            },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
    });

    afterAll(async () => {
        // Clean up test data
        const db = await connectDB();
        await db.collection('users').deleteMany({ email: 'testadmin@example.com' });
        if (testCourseId) {
            await db.collection('courses').deleteOne({ _id: testCourseId });
        }
    });

    describe('POST /api/admin/courses', () => {
        it('should create a new course with valid data', async () => {
            const courseData = {
                title: 'Test Course',
                description: 'This is a test course',
                price: 99.99,
                status: 'draft',
                modules: [
                    {
                        title: 'Module 1',
                        description: 'Introduction',
                        order: 1,
                        lessons: [
                            {
                                title: 'Lesson 1',
                                content: 'Welcome to the course',
                                duration: 30,
                                order: 1
                            }
                        ]
                    }
                ]
            };

            const res = await request(app)
                .post('/api/admin/courses')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(courseData)
                .expect(201);

            expect(res.body.success).toBe(true);
            expect(res.body.courseId).toBeDefined();
            testCourseId = res.body.courseId;
        });

        it('should return 400 for missing required fields', async () => {
            const res = await request(app)
                .post('/api/admin/courses')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ title: 'Incomplete Course' })
                .expect(400);

            expect(res.body.success).toBe(false);
            expect(res.body.message).toContain('Missing required fields');
        });
    });

    describe('GET /api/admin/courses', () => {
        it('should return list of courses', async () => {
            const res = await request(app)
                .get('/api/admin/courses')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });
    });
});
