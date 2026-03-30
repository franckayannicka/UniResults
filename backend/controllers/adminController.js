// backend/controllers/adminController.js
const bcrypt = require('bcryptjs');
const db = require('../config/db');

// ============================================================
// HELPERS
// ============================================================
const padSeq = (num) => String(num).padStart(3, '0');

// Formats matric numbers as DEPT/YEAR/SEQ
const generateMatricNumber = (departmentCode, academicYear, currentCount = 0) => {
    return `${departmentCode}/${academicYear}/${padSeq(currentCount + 1)}`;
};

// Formats staff IDs as STAFF/DEPT/SEQ
const generateStaffId = (departmentCode, currentCount = 0) => {
    return `STAFF/${departmentCode}/${padSeq(currentCount + 1)}`;
};

// ============================================================
// DEPARTMENTS
// ============================================================

const createDepartment = async (req, res) => {
    try {
        const { name, code, description } = req.body;
        if (!name || !code) return res.status(400).json({ success: false, message: 'Name and code are required.' });

        const [existing] = await db.query('SELECT id FROM departments WHERE code = ? OR name = ?', [code.toUpperCase(), name]);
        if (existing.length > 0) return res.status(409).json({ success: false, message: 'Department name or code already exists.' });

        const [result] = await db.query(
            'INSERT INTO departments (name, code, description) VALUES (?, ?, ?)',
            [name.trim(), code.toUpperCase().trim(), description || null]
        );
        await logAction(req.user.userId, 'CREATE_DEPARTMENT', 'departments', result.insertId, `Created department: ${name}`);
        return res.status(201).json({ success: true, message: 'Department created successfully.', departmentId: result.insertId });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error creating department.' });
    }
};

const getDepartments = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM departments ORDER BY name ASC');
        return res.json({ success: true, departments: rows });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ============================================================
// STUDENTS
// ============================================================

const registerStudent = async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const { email, password, first_name, last_name, matric_number, department_id, level, phone, date_of_birth } = req.body;

        if (!email || !password || !first_name || !last_name || !matric_number || !department_id) {
            await conn.rollback(); conn.release();
            return res.status(400).json({ success: false, message: 'Required fields: email, password, first_name, last_name, matric_number, department_id.' });
        }

        // Check existing email
        const [existingUser] = await conn.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
        if (existingUser.length > 0) { await conn.rollback(); conn.release(); return res.status(409).json({ success: false, message: 'Email already in use.' }); }

        // Check existing matric
        const [existingMatric] = await conn.query('SELECT id FROM students WHERE matric_number = ?', [matric_number]);
        if (existingMatric.length > 0) { await conn.rollback(); conn.release(); return res.status(409).json({ success: false, message: 'Matric number already exists.' }); }

        const hashed = await bcrypt.hash(password, 12);
        const [userResult] = await conn.query(
            'INSERT INTO users (email, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)',
            [email.toLowerCase().trim(), hashed, first_name.trim(), last_name.trim(), 'student']
        );

        const [studentResult] = await conn.query(
            'INSERT INTO students (user_id, matric_number, department_id, level, phone, date_of_birth) VALUES (?, ?, ?, ?, ?, ?)',
            [userResult.insertId, matric_number.trim(), department_id, level || '100', phone || null, date_of_birth || null]
        );

        await conn.commit();
        await logAction(req.user.userId, 'REGISTER_STUDENT', 'students', studentResult.insertId, `Registered student: ${email}`);
        conn.release();
        return res.status(201).json({ success: true, message: 'Student registered successfully.', userId: userResult.insertId, studentId: studentResult.insertId });
    } catch (error) {
        await conn.rollback(); conn.release();
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error registering student.' });
    }
};

// ============================================================
// LECTURERS
// ============================================================

const registerLecturer = async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const { email, password, first_name, last_name, staff_id, department_id, title, phone, specialization } = req.body;

        if (!email || !password || !first_name || !last_name || !staff_id || !department_id) {
            await conn.rollback(); conn.release();
            return res.status(400).json({ success: false, message: 'Required fields: email, password, first_name, last_name, staff_id, department_id.' });
        }

        const [existingUser] = await conn.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
        if (existingUser.length > 0) { await conn.rollback(); conn.release(); return res.status(409).json({ success: false, message: 'Email already in use.' }); }

        const [existingStaff] = await conn.query('SELECT id FROM lecturers WHERE staff_id = ?', [staff_id]);
        if (existingStaff.length > 0) { await conn.rollback(); conn.release(); return res.status(409).json({ success: false, message: 'Staff ID already exists.' }); }

        const hashed = await bcrypt.hash(password, 12);
        const [userResult] = await conn.query(
            'INSERT INTO users (email, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)',
            [email.toLowerCase().trim(), hashed, first_name.trim(), last_name.trim(), 'lecturer']
        );

        const [lecturerResult] = await conn.query(
            'INSERT INTO lecturers (user_id, staff_id, department_id, title, phone, specialization) VALUES (?, ?, ?, ?, ?, ?)',
            [userResult.insertId, staff_id.trim(), department_id, title || null, phone || null, specialization || null]
        );

        await conn.commit();
        await logAction(req.user.userId, 'REGISTER_LECTURER', 'lecturers', lecturerResult.insertId, `Registered lecturer: ${email}`);
        conn.release();
        return res.status(201).json({ success: true, message: 'Lecturer registered successfully.', userId: userResult.insertId, lecturerId: lecturerResult.insertId });
    } catch (error) {
        await conn.rollback(); conn.release();
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error registering lecturer.' });
    }
};

// ============================================================
// COURSES
// ============================================================

const createCourse = async (req, res) => {
    try {
        const { department_id, course_code, course_title, credit_units, semester, level, description } = req.body;
        if (!department_id || !course_code || !course_title) {
            return res.status(400).json({ success: false, message: 'department_id, course_code, and course_title are required.' });
        }

        const [existing] = await db.query('SELECT id FROM courses WHERE course_code = ?', [course_code.toUpperCase()]);
        if (existing.length > 0) return res.status(409).json({ success: false, message: 'Course code already exists.' });

        const [result] = await db.query(
            'INSERT INTO courses (department_id, course_code, course_title, credit_units, semester, level, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [department_id, course_code.toUpperCase().trim(), course_title.trim(), credit_units || 3, semester || 'first', level || '100', description || null]
        );
        await logAction(req.user.userId, 'CREATE_COURSE', 'courses', result.insertId, `Created course: ${course_code}`);
        return res.status(201).json({ success: true, message: 'Course created successfully.', courseId: result.insertId });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error creating course.' });
    }
};

const getCourses = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT c.*, d.name as department_name,
             (SELECT CONCAT(u.first_name,' ',u.last_name) FROM lecturer_courses lc
              JOIN lecturers l ON lc.lecturer_id = l.id
              JOIN users u ON l.user_id = u.id
              WHERE lc.course_id = c.id LIMIT 1) as assigned_lecturer
             FROM courses c JOIN departments d ON c.department_id = d.id ORDER BY c.course_code ASC`
        );
        return res.json({ success: true, courses: rows });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ============================================================
// ASSIGN COURSE TO LECTURER
// ============================================================

const assignCourse = async (req, res) => {
    try {
        const { lecturer_id, course_id, academic_year } = req.body;
        if (!lecturer_id || !course_id) return res.status(400).json({ success: false, message: 'lecturer_id and course_id are required.' });

        const [existing] = await db.query(
            'SELECT id FROM lecturer_courses WHERE lecturer_id = ? AND course_id = ? AND academic_year = ?',
            [lecturer_id, course_id, academic_year || '2024/2025']
        );
        if (existing.length > 0) return res.status(409).json({ success: false, message: 'Course already assigned to this lecturer for this academic year.' });

        const [result] = await db.query(
            'INSERT INTO lecturer_courses (lecturer_id, course_id, academic_year) VALUES (?, ?, ?)',
            [lecturer_id, course_id, academic_year || '2024/2025']
        );
        await logAction(req.user.userId, 'ASSIGN_COURSE', 'lecturer_courses', result.insertId, `Assigned course ${course_id} to lecturer ${lecturer_id}`);
        return res.status(201).json({ success: true, message: 'Course assigned to lecturer successfully.' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error assigning course.' });
    }
};

// ============================================================
// ENROLL STUDENT
// ============================================================

const enrollStudent = async (req, res) => {
    try {
        const { student_id, course_id, academic_year } = req.body;
        if (!student_id || !course_id) return res.status(400).json({ success: false, message: 'student_id and course_id are required.' });

        const [existing] = await db.query(
            'SELECT id FROM enrollments WHERE student_id = ? AND course_id = ? AND academic_year = ?',
            [student_id, course_id, academic_year || '2024/2025']
        );
        if (existing.length > 0) return res.status(409).json({ success: false, message: 'Student already enrolled in this course.' });

        const [result] = await db.query(
            'INSERT INTO enrollments (student_id, course_id, academic_year) VALUES (?, ?, ?)',
            [student_id, course_id, academic_year || '2024/2025']
        );
        await logAction(req.user.userId, 'ENROLL_STUDENT', 'enrollments', result.insertId, `Enrolled student ${student_id} in course ${course_id}`);
        return res.status(201).json({ success: true, message: 'Student enrolled successfully.' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error enrolling student.' });
    }
};

// ============================================================
// GET ALL USERS
// ============================================================

const getUsers = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.is_active, u.created_at,
             CASE
               WHEN u.role = 'student' THEN s.matric_number
               WHEN u.role = 'lecturer' THEN l.staff_id
               ELSE 'N/A'
             END as identifier,
             CASE
               WHEN u.role = 'student' THEN ds.name
               WHEN u.role = 'lecturer' THEN dl.name
               ELSE 'N/A'
             END as department_name
             FROM users u
             LEFT JOIN students s ON u.id = s.user_id
             LEFT JOIN lecturers l ON u.id = l.user_id
             LEFT JOIN departments ds ON s.department_id = ds.id
             LEFT JOIN departments dl ON l.department_id = dl.id
             ORDER BY u.created_at DESC`
        );
        return res.json({ success: true, users: rows });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ============================================================
// DASHBOARD SUMMARY
// ============================================================

const getDashboardSummary = async (req, res) => {
    try {
        const [[{ students }]] = await db.query('SELECT COUNT(*) as students FROM students');
        const [[{ lecturers }]] = await db.query('SELECT COUNT(*) as lecturers FROM lecturers');
        const [[{ courses }]] = await db.query('SELECT COUNT(*) as courses FROM courses');
        const [[{ departments }]] = await db.query('SELECT COUNT(*) as departments FROM departments');
        const [[{ enrollments }]] = await db.query('SELECT COUNT(*) as enrollments FROM enrollments');
        const [[{ marks }]] = await db.query('SELECT COUNT(*) as marks FROM marks');
        return res.json({ success: true, summary: { students, lecturers, courses, departments, enrollments, marks } });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// GET all students list
const getStudents = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT s.id, s.matric_number, s.level, s.user_id, u.first_name, u.last_name, u.email, u.is_active,
                    d.name as department_name
             FROM students s JOIN users u ON s.user_id = u.id JOIN departments d ON s.department_id = d.id
             ORDER BY u.last_name ASC`
        );
        return res.json({ success: true, students: rows });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// GET all lecturers list
const getLecturers = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT l.id, l.staff_id, l.title, l.user_id, u.first_name, u.last_name, u.email, u.is_active,
                    d.name as department_name
             FROM lecturers l JOIN users u ON l.user_id = u.id JOIN departments d ON l.department_id = d.id
             ORDER BY u.last_name ASC`
        );
        return res.json({ success: true, lecturers: rows });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ============================================================
// ID GENERATORS
// ============================================================
const getSuggestedMatric = async (req, res) => {
    try {
        const { department_id, academic_year } = req.query;
        if (!department_id) return res.status(400).json({ success: false, message: 'department_id is required.' });

        const [deptRows] = await db.query('SELECT code FROM departments WHERE id = ?', [department_id]);
        if (deptRows.length === 0) return res.status(404).json({ success: false, message: 'Department not found.' });

        const academicYear = academic_year || new Date().getFullYear();
        const [[{ count }]] = await db.query('SELECT COUNT(*) as count FROM students WHERE department_id = ?', [department_id]);
        const matric_number = generateMatricNumber(deptRows[0].code, academicYear, count);
        return res.json({ success: true, message: 'Matric number generated.', matric_number });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error generating matric number.' });
    }
};

const getSuggestedStaffId = async (req, res) => {
    try {
        const { department_id } = req.query;
        if (!department_id) return res.status(400).json({ success: false, message: 'department_id is required.' });

        const [deptRows] = await db.query('SELECT code FROM departments WHERE id = ?', [department_id]);
        if (deptRows.length === 0) return res.status(404).json({ success: false, message: 'Department not found.' });

        const [[{ count }]] = await db.query('SELECT COUNT(*) as count FROM lecturers WHERE department_id = ?', [department_id]);
        const staff_id = generateStaffId(deptRows[0].code, count);
        return res.json({ success: true, message: 'Staff ID generated.', staff_id });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error generating staff ID.' });
    }
};

// ============================================================
// SINGLE STUDENT / LECTURER CRUD
// ============================================================
const getStudentById = async (req, res) => {
    try {
        const { studentId } = req.params;
        const [rows] = await db.query(
            `SELECT s.id, s.matric_number, s.level, s.phone, s.department_id, u.id as user_id, u.first_name, u.last_name, u.email
             FROM students s JOIN users u ON s.user_id = u.id WHERE s.id = ?`,
            [studentId]
        );
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Student not found.' });
        return res.json({ success: true, student: rows[0] });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error fetching student.' });
    }
};

const updateStudent = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { first_name, last_name, email, level, phone, department_id } = req.body;
        if (!first_name || !last_name || !email || !department_id) {
            return res.status(400).json({ success: false, message: 'first_name, last_name, email, department_id are required.' });
        }
        const [existing] = await db.query('SELECT s.id, s.user_id FROM students s WHERE s.id = ?', [studentId]);
        if (existing.length === 0) return res.status(404).json({ success: false, message: 'Student not found.' });

        const userId = existing[0].user_id;
        const [emailCheck] = await db.query('SELECT id FROM users WHERE email = ? AND id <> ?', [email.toLowerCase(), userId]);
        if (emailCheck.length > 0) return res.status(409).json({ success: false, message: 'Email already in use by another user.' });

        await db.query('UPDATE users SET first_name = ?, last_name = ?, email = ? WHERE id = ?', [
            first_name.trim(), last_name.trim(), email.toLowerCase().trim(), userId
        ]);
        await db.query('UPDATE students SET level = ?, phone = ?, department_id = ? WHERE id = ?', [
            level || null, phone || null, department_id, studentId
        ]);

        await logAction(req.user.userId, 'UPDATE_STUDENT', 'students', studentId, 'Updated student record');
        return res.json({ success: true, message: 'Student updated successfully.' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error updating student.' });
    }
};

const getLecturerById = async (req, res) => {
    try {
        const { lecturerId } = req.params;
        const [rows] = await db.query(
            `SELECT l.id, l.staff_id, l.title, l.phone, l.specialization, l.department_id,
                    u.id as user_id, u.first_name, u.last_name, u.email
             FROM lecturers l JOIN users u ON l.user_id = u.id WHERE l.id = ?`,
            [lecturerId]
        );
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Lecturer not found.' });
        return res.json({ success: true, lecturer: rows[0] });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error fetching lecturer.' });
    }
};

const updateLecturer = async (req, res) => {
    try {
        const { lecturerId } = req.params;
        const { first_name, last_name, email, title, phone, specialization, department_id } = req.body;
        if (!first_name || !last_name || !email || !department_id) {
            return res.status(400).json({ success: false, message: 'first_name, last_name, email, department_id are required.' });
        }
        const [existing] = await db.query('SELECT l.id, l.user_id FROM lecturers l WHERE l.id = ?', [lecturerId]);
        if (existing.length === 0) return res.status(404).json({ success: false, message: 'Lecturer not found.' });

        const userId = existing[0].user_id;
        const [emailCheck] = await db.query('SELECT id FROM users WHERE email = ? AND id <> ?', [email.toLowerCase(), userId]);
        if (emailCheck.length > 0) return res.status(409).json({ success: false, message: 'Email already in use by another user.' });

        await db.query('UPDATE users SET first_name = ?, last_name = ?, email = ? WHERE id = ?', [
            first_name.trim(), last_name.trim(), email.toLowerCase().trim(), userId
        ]);
        await db.query('UPDATE lecturers SET title = ?, phone = ?, specialization = ?, department_id = ? WHERE id = ?', [
            title || null, phone || null, specialization || null, department_id, lecturerId
        ]);

        await logAction(req.user.userId, 'UPDATE_LECTURER', 'lecturers', lecturerId, 'Updated lecturer record');
        return res.json({ success: true, message: 'Lecturer updated successfully.' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error updating lecturer.' });
    }
};

// Soft delete / toggle user status
const deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const [rows] = await db.query('SELECT is_active FROM users WHERE id = ?', [userId]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'User not found.' });

        const currentStatus = rows[0].is_active === 1;
        const newStatus = currentStatus ? 0 : 1;
        await db.query('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, userId]);
        await logAction(req.user.userId, 'TOGGLE_USER', 'users', userId, `User ${newStatus ? 'activated' : 'deactivated'}`);
        return res.json({ success: true, message: newStatus ? 'User activated.' : 'User deactivated.' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error updating user status.' });
    }
};

// ============================================================
// COURSE CRUD
// ============================================================
const updateCourse = async (req, res) => {
    try {
        const { courseId } = req.params;
        const { course_title, credit_units, semester, level, description } = req.body;
        if (!course_title || credit_units === undefined || !semester || !level) {
            return res.status(400).json({ success: false, message: 'course_title, credit_units, semester, and level are required.' });
        }

        const [existing] = await db.query('SELECT id FROM courses WHERE id = ?', [courseId]);
        if (existing.length === 0) return res.status(404).json({ success: false, message: 'Course not found.' });

        await db.query(
            'UPDATE courses SET course_title = ?, credit_units = ?, semester = ?, level = ?, description = ? WHERE id = ?',
            [course_title.trim(), credit_units, semester, level, description || null, courseId]
        );

        await logAction(req.user.userId, 'UPDATE_COURSE', 'courses', courseId, 'Updated course');
        return res.json({ success: true, message: 'Course updated successfully.' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error updating course.' });
    }
};

const deleteCourse = async (req, res) => {
    try {
        const { courseId } = req.params;
        const [existing] = await db.query('SELECT id FROM courses WHERE id = ?', [courseId]);
        if (existing.length === 0) return res.status(404).json({ success: false, message: 'Course not found.' });
        const [[{ count }]] = await db.query('SELECT COUNT(*) as count FROM marks WHERE course_id = ?', [courseId]);
        if (count > 0) {
            return res.status(400).json({ success: false, message: 'Cannot delete course with existing marks. Remove marks first.' });
        }

        await db.query('DELETE FROM courses WHERE id = ?', [courseId]);
        await logAction(req.user.userId, 'DELETE_COURSE', 'courses', courseId, 'Deleted course');
        return res.json({ success: true, message: 'Course deleted successfully.' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error deleting course.' });
    }
};

// ============================================================
// DEPARTMENTS CRUD
// ============================================================
const updateDepartment = async (req, res) => {
    try {
        const { deptId } = req.params;
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'name is required.' });
        const [existing] = await db.query('SELECT id FROM departments WHERE id = ?', [deptId]);
        if (existing.length === 0) return res.status(404).json({ success: false, message: 'Department not found.' });

        await db.query('UPDATE departments SET name = ?, description = ? WHERE id = ?', [name.trim(), description || null, deptId]);
        await logAction(req.user.userId, 'UPDATE_DEPARTMENT', 'departments', deptId, 'Updated department');
        return res.json({ success: true, message: 'Department updated successfully.' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error updating department.' });
    }
};

const deleteDepartment = async (req, res) => {
    try {
        const { deptId } = req.params;
        const [existing] = await db.query('SELECT id FROM departments WHERE id = ?', [deptId]);
        if (existing.length === 0) return res.status(404).json({ success: false, message: 'Department not found.' });
        const [[{ count }]] = await db.query('SELECT COUNT(*) as count FROM courses WHERE department_id = ?', [deptId]);
        if (count > 0) return res.status(400).json({ success: false, message: 'Department has courses. Remove courses first.' });

        await db.query('DELETE FROM departments WHERE id = ?', [deptId]);
        await logAction(req.user.userId, 'DELETE_DEPARTMENT', 'departments', deptId, 'Deleted department');
        return res.json({ success: true, message: 'Department deleted successfully.' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error deleting department.' });
    }
};

// ============================================================
// ENROLLMENTS & ASSIGNMENTS
// ============================================================
const getEnrollments = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT e.id, e.academic_year, s.matric_number, CONCAT(u.first_name, ' ', u.last_name) as student_name,
                    c.course_code, c.course_title
             FROM enrollments e
             JOIN students s ON e.student_id = s.id
             JOIN users u ON s.user_id = u.id
             JOIN courses c ON e.course_id = c.id
                 ORDER BY e.id DESC`
        );
        return res.json({ success: true, enrollments: rows });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error fetching enrollments.' });
    }
};

const deleteEnrollment = async (req, res) => {
    try {
        const { enrollmentId } = req.params;
        await db.query('DELETE FROM enrollments WHERE id = ?', [enrollmentId]);
        await logAction(req.user.userId, 'DELETE_ENROLLMENT', 'enrollments', enrollmentId, 'Deleted enrollment');
        return res.json({ success: true, message: 'Enrollment deleted successfully.' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error deleting enrollment.' });
    }
};

const getAssignments = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT lc.id, lc.academic_year, c.course_code, c.course_title,
                    CONCAT(u.first_name, ' ', u.last_name) as lecturer_name, l.title
             FROM lecturer_courses lc
             JOIN courses c ON lc.course_id = c.id
             JOIN lecturers l ON lc.lecturer_id = l.id
             JOIN users u ON l.user_id = u.id
             ORDER BY c.course_code ASC`
        );
        return res.json({ success: true, assignments: rows });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error fetching assignments.' });
    }
};

const deleteAssignment = async (req, res) => {
    try {
        const { assignmentId } = req.params;
        await db.query('DELETE FROM lecturer_courses WHERE id = ?', [assignmentId]);
        await logAction(req.user.userId, 'DELETE_ASSIGNMENT', 'lecturer_courses', assignmentId, 'Deleted assignment');
        return res.json({ success: true, message: 'Assignment deleted successfully.' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error deleting assignment.' });
    }
};

// ============================================================
// FULL RESULTS & PASSWORD RESET
// ============================================================
const getFullResults = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                CONCAT(u.first_name, ' ', u.last_name) as student_name,
                s.matric_number,
                c.course_code,
                c.course_title,
                c.credit_units,
                m.ca_score,
                m.exam_score,
                m.total_score,
                m.grade,
                m.academic_year,
                d.name as department_name,
                CONCAT(lu.first_name, ' ', lu.last_name) as lecturer_name
            FROM marks m
            JOIN students s ON m.student_id = s.id
            JOIN users u ON s.user_id = u.id
            JOIN courses c ON m.course_id = c.id
            JOIN departments d ON s.department_id = d.id
            JOIN lecturers l ON m.lecturer_id = l.id
            JOIN users lu ON l.user_id = lu.id
            ORDER BY s.matric_number ASC, c.course_code ASC
        `);
        return res.json({ success: true, results: rows });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error fetching full results.' });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { userId } = req.params;
        const { new_password } = req.body;
        if (!new_password) return res.status(400).json({ success: false, message: 'new_password is required.' });

        const [existing] = await db.query('SELECT id FROM users WHERE id = ?', [userId]);
        if (existing.length === 0) return res.status(404).json({ success: false, message: 'User not found.' });

        const hashed = await bcrypt.hash(new_password, 12);
        await db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, userId]);
        await logAction(req.user.userId, 'RESET_PASSWORD', 'users', userId, 'Password reset by admin');
        return res.json({ success: true, message: 'Password reset successfully.' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error resetting password.' });
    }
};

// ============================================================
// HELPER: Audit Log
// ============================================================
const logAction = async (userId, action, table, recordId, details) => {
    try {
        await db.query(
            'INSERT INTO audit_logs (user_id, action, table_affected, record_id, details) VALUES (?, ?, ?, ?, ?)',
            [userId, action, table, recordId, details]
        );
    } catch (e) { /* silent fail for logs */ }
};

module.exports = {
    createDepartment, getDepartments,
    registerStudent, registerLecturer,
    createCourse, getCourses,
    assignCourse, enrollStudent,
    getUsers, getDashboardSummary, getStudents, getLecturers,
    getSuggestedMatric, getSuggestedStaffId,
    getStudentById, updateStudent,
    getLecturerById, updateLecturer,
    deleteUser, updateCourse, deleteCourse,
    updateDepartment, deleteDepartment,
    getEnrollments, deleteEnrollment,
    getAssignments, deleteAssignment,
    getFullResults, resetPassword
};
