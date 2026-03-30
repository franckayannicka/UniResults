const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
    getMyProfile,
    updateProfile,
    changePassword,
    uploadProfilePicture,
    removeProfilePicture
} = require('../controllers/profileController');

// Import multer — handle the case where upload config may not exist yet
let upload;
try {
    upload = require('../config/upload');
} catch (e) {
    // Create inline multer config as fallback
    const multer = require('multer');
    const path = require('path');
    const fs = require('fs');
    const uploadDir = path.join(__dirname, '../uploads/profiles');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadDir),
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            cb(null, `user_${req.user ? req.user.userId : 'unknown'}_${Date.now()}${ext}`);
        }
    });
    upload = multer({
        storage,
        limits: { fileSize: 3 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
            const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
            const ext = path.extname(file.originalname).toLowerCase();
            allowed.includes(ext) ? cb(null, true) : cb(new Error('Only JPG, PNG, WEBP allowed.'), false);
        }
    });
}

router.get('/me', authenticate, getMyProfile);
router.put('/update', authenticate, updateProfile);
router.put('/change-password', authenticate, changePassword);
router.post('/upload-picture', authenticate, upload.single('profile_picture'), uploadProfilePicture);
router.delete('/remove-picture', authenticate, removeProfilePicture);

module.exports = router;
