// backend/controllers/studentController.js
const db = require('../config/db');

/**
 * GET /api/student/my-courses
 * Courses the student is enrolled in
 */
const getMyCourses = async (req, res) => {
    try {
        const studentId = req.user.profileId;
        if (!studentId) return res.status(400).json({ success: false, message: 'Student profile not found.' });

        const [rows] = await db.query(
            `SELECT c.id, c.course_code, c.course_title, c.credit_units, c.semester, c.level,
             d.name as department_name, e.academic_year,
             CONCAT(u.first_name, ' ', u.last_name) as lecturer_name,
             lect.title as lecturer_title
             FROM enrollments e
             JOIN courses c ON e.course_id = c.id
             JOIN departments d ON c.department_id = d.id
             LEFT JOIN lecturer_courses lc ON lc.course_id = c.id AND lc.academic_year = e.academic_year
             LEFT JOIN lecturers lect ON lc.lecturer_id = lect.id
             LEFT JOIN users u ON lect.user_id = u.id
             WHERE e.student_id = ?
             ORDER BY c.course_code ASC`,
            [studentId]
        );
        return res.json({ success: true, courses: rows });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error fetching courses.' });
    }
};

/**
 * GET /api/student/my-results
 * Marks/results for all enrolled courses
 */
const getMyResults = async (req, res) => {
    try {
        const studentId = req.user.profileId;
        if (!studentId) return res.status(400).json({ success: false, message: 'Student profile not found.' });

        const [rows] = await db.query(
            `SELECT c.course_code, c.course_title, c.credit_units, c.semester,
             m.ca_score, m.exam_score, m.total_score, m.grade, m.remarks, m.academic_year,
             CONCAT(u.first_name, ' ', u.last_name) as lecturer_name
             FROM enrollments e
             JOIN courses c ON e.course_id = c.id
             LEFT JOIN marks m ON m.student_id = e.student_id AND m.course_id = e.course_id
             LEFT JOIN lecturers l ON m.lecturer_id = l.id
             LEFT JOIN users u ON l.user_id = u.id
             WHERE e.student_id = ?
             ORDER BY m.academic_year DESC, c.course_code ASC`,
            [studentId]
        );
        return res.json({ success: true, results: rows });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error fetching results.' });
    }
};

/**
 * GET /api/student/gpa-summary
 * GPA calculation using standard 5-point scale
 */
const getGpaSummary = async (req, res) => {
    try {
        const studentId = req.user.profileId;
        if (!studentId) return res.status(400).json({ success: false, message: 'Student profile not found.' });

        const [marks] = await db.query(
            `SELECT c.credit_units, m.total_score, m.grade
             FROM marks m
             JOIN courses c ON m.course_id = c.id
             WHERE m.student_id = ?`,
            [studentId]
        );

        if (marks.length === 0) {
            return res.json({ success: true, gpa: 0, total_credit_units: 0, grade_points: 0, courses_completed: 0 });
        }

        // 5-point grading scale
        const gradePoints = { A: 5.0, B: 4.0, C: 3.0, D: 2.0, E: 1.0, F: 0.0 };
        let totalPoints = 0;
        let totalUnits = 0;
        let passedUnits = 0;

        marks.forEach(m => {
            const gp = gradePoints[m.grade] || 0;
            totalPoints += gp * m.credit_units;
            totalUnits += m.credit_units;
            if (m.grade !== 'F') passedUnits += m.credit_units;
        });

        const gpa = totalUnits > 0 ? (totalPoints / totalUnits).toFixed(2) : 0;

        // Grade distribution
        const distribution = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
        marks.forEach(m => { if (distribution[m.grade] !== undefined) distribution[m.grade]++; });

        return res.json({
            success: true,
            gpa: parseFloat(gpa),
            total_credit_units: totalUnits,
            passed_credit_units: passedUnits,
            grade_points: parseFloat(totalPoints.toFixed(2)),
            courses_completed: marks.length,
            grade_distribution: distribution,
            classification: getClassification(parseFloat(gpa))
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error calculating GPA.' });
    }
};

const getClassification = (gpa) => {
    if (gpa >= 4.5) return 'First Class Honours';
    if (gpa >= 3.5) return 'Second Class Upper';
    if (gpa >= 2.5) return 'Second Class Lower';
    if (gpa >= 1.5) return 'Third Class';
    if (gpa >= 1.0) return 'Pass';
    return 'Fail';
};

/**
 * GET /api/student/profile
 */
const getProfile = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT u.first_name, u.last_name, u.email, s.matric_number, s.level, s.phone,
             s.date_of_birth, d.name as department_name
             FROM students s
             JOIN users u ON s.user_id = u.id
             JOIN departments d ON s.department_id = d.id
             WHERE s.id = ?`,
            [req.user.profileId]
        );
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Profile not found.' });
        return res.json({ success: true, profile: rows[0] });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

module.exports = { getMyCourses, getMyResults, getGpaSummary, getProfile };
