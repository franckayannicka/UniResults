// backend/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
    createDepartment, getDepartments,
    registerStudent, registerLecturer,
    createCourse, getCourses, assignCourse, enrollStudent,
    getUsers, getDashboardSummary, getStudents, getLecturers,
    getSuggestedMatric, getSuggestedStaffId,
    getStudentById, updateStudent,
    getLecturerById, updateLecturer,
    deleteUser, updateCourse, deleteCourse,
    updateDepartment, deleteDepartment,
    getEnrollments, deleteEnrollment,
    getAssignments, deleteAssignment,
    getFullResults, resetPassword
} = require('../controllers/adminController');

// All admin routes require auth + admin role
router.use(authenticate, authorize('admin'));

router.get('/dashboard-summary', getDashboardSummary);
router.get('/generate-matric', getSuggestedMatric);
router.get('/generate-staff-id', getSuggestedStaffId);

// Departments
router.post('/create-department', createDepartment);
router.get('/departments', getDepartments);
router.put('/update-department/:deptId', updateDepartment);
router.delete('/delete-department/:deptId', deleteDepartment);

// Users
router.get('/users', getUsers);
router.get('/students', getStudents);
router.get('/lecturers', getLecturers);
router.get('/student/:studentId', getStudentById);
router.get('/lecturer/:lecturerId', getLecturerById);
router.put('/update-student/:studentId', updateStudent);
router.put('/update-lecturer/:lecturerId', updateLecturer);
router.delete('/delete-user/:userId', deleteUser);
router.put('/reset-password/:userId', resetPassword);

// Registration
router.post('/register-student', registerStudent);
router.post('/register-lecturer', registerLecturer);

// Courses
router.post('/create-course', createCourse);
router.get('/courses', getCourses);
router.post('/assign-course', assignCourse);
router.post('/enroll-student', enrollStudent);
router.put('/update-course/:courseId', updateCourse);
router.delete('/delete-course/:courseId', deleteCourse);

// Enrollments & assignments
router.get('/enrollments', getEnrollments);
router.delete('/delete-enrollment/:enrollmentId', deleteEnrollment);
router.get('/assignments', getAssignments);
router.delete('/delete-assignment/:assignmentId', deleteAssignment);

// Full results report
router.get('/full-results', getFullResults);

module.exports = router;
