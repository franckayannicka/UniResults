// backend/controllers/lecturerController.js
const db = require('../config/db');

/**
 * GET /api/lecturer/my-courses
 * Courses assigned to the logged-in lecturer
 */
const getMyCourses = async (req, res) => {
    try {
        const lecturerId = req.user.profileId;
        if (!lecturerId) return res.status(400).json({ success: false, message: 'Lecturer profile not found.' });

        const [rows] = await db.query(
            `SELECT c.id, c.course_code, c.course_title, c.credit_units, c.semester, c.level,
             d.name as department_name, lc.academic_year,
             (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.academic_year = lc.academic_year) as enrolled_count
             FROM lecturer_courses lc
             JOIN courses c ON lc.course_id = c.id
             JOIN departments d ON c.department_id = d.id
             WHERE lc.lecturer_id = ?
             ORDER BY c.course_code ASC`,
            [lecturerId]
        );
        return res.json({ success: true, courses: rows });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error fetching courses.' });
    }
};

/**
 * GET /api/lecturer/course-students/:courseId
 * Students enrolled in a specific course, with their marks if uploaded
 */
const getCourseStudents = async (req, res) => {
    try {
        const lecturerId = req.user.profileId;
        const { courseId } = req.params;

        // Verify this lecturer is assigned to this course
        const [assignment] = await db.query(
            'SELECT id FROM lecturer_courses WHERE lecturer_id = ? AND course_id = ?',
            [lecturerId, courseId]
        );
        if (assignment.length === 0) {
            return res.status(403).json({ success: false, message: 'You are not assigned to this course.' });
        }

        const [students] = await db.query(
            `SELECT s.id as student_id, s.matric_number, u.first_name, u.last_name, u.email,
             m.id as mark_id, m.ca_score, m.exam_score, m.total_score, m.grade, m.remarks, m.academic_year
             FROM enrollments e
             JOIN students s ON e.student_id = s.id
             JOIN users u ON s.user_id = u.id
             LEFT JOIN marks m ON m.student_id = s.id AND m.course_id = ? AND m.lecturer_id = ?
             WHERE e.course_id = ?
             ORDER BY u.last_name ASC`,
            [courseId, lecturerId, courseId]
        );
        return res.json({ success: true, students });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error fetching students.' });
    }
};

/**
 * POST /api/lecturer/upload-marks
 * Upload marks for a student in a course
 */
const uploadMarks = async (req, res) => {
    try {
        const lecturerId = req.user.profileId;
        const { student_id, course_id, ca_score, exam_score, academic_year, remarks } = req.body;

        if (!student_id || !course_id || ca_score === undefined || exam_score === undefined) {
            return res.status(400).json({ success: false, message: 'student_id, course_id, ca_score, and exam_score are required.' });
        }

        // Validate score ranges
        if (ca_score < 0 || ca_score > 40) return res.status(400).json({ success: false, message: 'CA score must be between 0 and 40.' });
        if (exam_score < 0 || exam_score > 60) return res.status(400).json({ success: false, message: 'Exam score must be between 0 and 60.' });

        // Verify lecturer is assigned to this course
        const [assignment] = await db.query(
            'SELECT id FROM lecturer_courses WHERE lecturer_id = ? AND course_id = ?',
            [lecturerId, course_id]
        );
        if (assignment.length === 0) {
            return res.status(403).json({ success: false, message: 'You are not assigned to this course.' });
        }

        // Verify student is enrolled in this course
        const [enrollment] = await db.query(
            'SELECT id FROM enrollments WHERE student_id = ? AND course_id = ?',
            [student_id, course_id]
        );
        if (enrollment.length === 0) {
            return res.status(400).json({ success: false, message: 'Student is not enrolled in this course.' });
        }

        // Check if mark already exists
        const [existing] = await db.query(
            'SELECT id FROM marks WHERE student_id = ? AND course_id = ? AND academic_year = ?',
            [student_id, course_id, academic_year || '2024/2025']
        );
        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: 'Marks already uploaded. Use update endpoint to modify.' });
        }

        const [result] = await db.query(
            'INSERT INTO marks (student_id, course_id, lecturer_id, ca_score, exam_score, academic_year, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [student_id, course_id, lecturerId, ca_score, exam_score, academic_year || '2024/2025', remarks || null]
        );

        return res.status(201).json({ success: true, message: 'Marks uploaded successfully.', markId: result.insertId });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error uploading marks.' });
    }
};

/**
 * PUT /api/lecturer/update-marks
 * Update existing marks
 */
const updateMarks = async (req, res) => {
    try {
        const lecturerId = req.user.profileId;
        const { mark_id, ca_score, exam_score, remarks } = req.body;

        if (!mark_id || ca_score === undefined || exam_score === undefined) {
            return res.status(400).json({ success: false, message: 'mark_id, ca_score, and exam_score are required.' });
        }

        if (ca_score < 0 || ca_score > 40) return res.status(400).json({ success: false, message: 'CA score must be between 0 and 40.' });
        if (exam_score < 0 || exam_score > 60) return res.status(400).json({ success: false, message: 'Exam score must be between 0 and 60.' });

        // Verify the mark belongs to this lecturer
        const [markRecord] = await db.query('SELECT id FROM marks WHERE id = ? AND lecturer_id = ?', [mark_id, lecturerId]);
        if (markRecord.length === 0) {
            return res.status(403).json({ success: false, message: 'Mark record not found or not authorized.' });
        }

        await db.query(
            'UPDATE marks SET ca_score = ?, exam_score = ?, remarks = ? WHERE id = ?',
            [ca_score, exam_score, remarks || null, mark_id]
        );

        return res.json({ success: true, message: 'Marks updated successfully.' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error updating marks.' });
    }
};

/**
 * DELETE /api/lecturer/delete-marks/:markId
 * Delete marks uploaded by this lecturer
 */
const deleteMarks = async (req, res) => {
    try {
        const lecturerId = req.user.profileId;
        if (!lecturerId) return res.status(400).json({ success: false, message: 'Lecturer profile not found.' });
        const { markId } = req.params;

        const [mark] = await db.query('SELECT lecturer_id FROM marks WHERE id = ?', [markId]);
        if (mark.length === 0) return res.status(404).json({ success: false, message: 'Mark record not found.' });
        if (mark[0].lecturer_id !== lecturerId) {
            return res.status(403).json({ success: false, message: 'Not authorized to delete this mark.' });
        }

        await db.query('DELETE FROM marks WHERE id = ?', [markId]);
        return res.json({ success: true, message: 'Marks deleted successfully.' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error deleting marks.' });
    }
};

module.exports = { getMyCourses, getCourseStudents, uploadMarks, updateMarks, deleteMarks };
