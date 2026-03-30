// backend/routes/lecturerRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getMyCourses, getCourseStudents, uploadMarks, updateMarks, deleteMarks } = require('../controllers/lecturerController');

router.use(authenticate, authorize('lecturer'));

router.get('/my-courses', getMyCourses);
router.get('/course-students/:courseId', getCourseStudents);
router.post('/upload-marks', uploadMarks);
router.put('/update-marks', updateMarks);
router.delete('/delete-marks/:markId', deleteMarks);

module.exports = router;
