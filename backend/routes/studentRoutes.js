// backend/routes/studentRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getMyCourses, getMyResults, getGpaSummary, getProfile } = require('../controllers/studentController');

router.use(authenticate, authorize('student'));

router.get('/profile', getProfile);
router.get('/my-courses', getMyCourses);
router.get('/my-results', getMyResults);
router.get('/gpa-summary', getGpaSummary);

module.exports = router;
