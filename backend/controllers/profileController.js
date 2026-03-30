const bcrypt = require('bcryptjs');
const db = require('../config/db');
const fs = require('fs');
const path = require('path');

// GET /api/profile/me
const getMyProfile = async (req, res) => {
    try {
        const userId = req.user.userId;

        // Safe query — select only columns that definitely exist
        // plus the new ones which runMigrations ensures exist
        const [users] = await db.query(
            `SELECT
                u.id,
                u.email,
                u.first_name,
                u.last_name,
                u.role,
                u.is_active,
                u.created_at,
                COALESCE(u.profile_picture, NULL) as profile_picture,
                COALESCE(u.bio, NULL) as bio,
                COALESCE(u.phone, NULL) as phone
             FROM users u
             WHERE u.id = ?`,
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const user = users[0];
        let roleData = {};

        if (user.role === 'student') {
            const [rows] = await db.query(
                `SELECT
                    s.id as student_profile_id,
                    s.matric_number,
                    s.level,
                    s.date_of_birth,
                    s.phone as student_phone,
                    d.name as department_name,
                    d.code as department_code
                 FROM students s
                 JOIN departments d ON s.department_id = d.id
                 WHERE s.user_id = ?`,
                [userId]
            );
            if (rows.length > 0) {
                roleData = rows[0];
                // Use student phone if user phone is null
                if (!user.phone && roleData.student_phone) {
                    user.phone = roleData.student_phone;
                }
            }
        } else if (user.role === 'lecturer') {
            const [rows] = await db.query(
                `SELECT
                    l.id as lecturer_profile_id,
                    l.staff_id,
                    l.title,
                    l.specialization,
                    l.phone as lecturer_phone,
                    d.name as department_name,
                    d.code as department_code
                 FROM lecturers l
                 JOIN departments d ON l.department_id = d.id
                 WHERE l.user_id = ?`,
                [userId]
            );
            if (rows.length > 0) {
                roleData = rows[0];
                if (!user.phone && roleData.lecturer_phone) {
                    user.phone = roleData.lecturer_phone;
                }
            }
        }
        // Admin has no extra profile table — roleData stays empty

        return res.json({
            success: true,
            profile: { ...user, ...roleData }
        });

    } catch (error) {
        console.error('getMyProfile error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error loading profile. Details: ' + error.message
        });
    }
};

// PUT /api/profile/update
const updateProfile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { first_name, last_name, bio, phone } = req.body;

        if (!first_name || !last_name) {
            return res.status(400).json({ success: false, message: 'First name and last name are required.' });
        }

        await db.query(
            `UPDATE users
             SET first_name = ?, last_name = ?, bio = ?, phone = ?, updated_at = NOW()
             WHERE id = ?`,
            [
                first_name.trim(),
                last_name.trim(),
                bio ? bio.trim() : null,
                phone ? phone.trim() : null,
                userId
            ]
        );

        return res.json({ success: true, message: 'Profile updated successfully.' });
    } catch (error) {
        console.error('updateProfile error:', error.message);
        return res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

// PUT /api/profile/change-password
const changePassword = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { current_password, new_password, confirm_password } = req.body;

        if (!current_password || !new_password || !confirm_password) {
            return res.status(400).json({ success: false, message: 'All password fields are required.' });
        }
        if (new_password !== confirm_password) {
            return res.status(400).json({ success: false, message: 'New password and confirmation do not match.' });
        }
        if (new_password.length < 6) {
            return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
        }

        const [users] = await db.query('SELECT password FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const isMatch = await bcrypt.compare(current_password, users[0].password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
        }

        const hashed = await bcrypt.hash(new_password, 12);
        await db.query(
            'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
            [hashed, userId]
        );

        try {
            await db.query(
                'INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)',
                [userId, 'PASSWORD_CHANGE', 'User changed their password']
            );
        } catch (logErr) { /* silent — audit log failure should not break the response */ }

        return res.json({ success: true, message: 'Password changed successfully.' });
    } catch (error) {
        console.error('changePassword error:', error.message);
        return res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

// POST /api/profile/upload-picture
const uploadProfilePicture = async (req, res) => {
    try {
        const userId = req.user.userId;

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image file uploaded.' });
        }

        // Delete old file if exists
        const [existing] = await db.query(
            'SELECT profile_picture FROM users WHERE id = ?',
            [userId]
        );
        if (existing.length > 0 && existing[0].profile_picture) {
            const oldFilename = path.basename(existing[0].profile_picture);
            const oldPath = path.join(__dirname, '../uploads/profiles', oldFilename);
            if (fs.existsSync(oldPath)) {
                try { fs.unlinkSync(oldPath); } catch (e) { /* ignore delete errors */ }
            }
        }

        const pictureUrl = `/uploads/profiles/${req.file.filename}`;

        await db.query(
            'UPDATE users SET profile_picture = ?, updated_at = NOW() WHERE id = ?',
            [pictureUrl, userId]
        );

        return res.json({
            success: true,
            message: 'Profile picture uploaded successfully.',
            picture_url: pictureUrl
        });
    } catch (error) {
        console.error('uploadProfilePicture error:', error.message);
        return res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

// DELETE /api/profile/remove-picture
const removeProfilePicture = async (req, res) => {
    try {
        const userId = req.user.userId;

        const [existing] = await db.query(
            'SELECT profile_picture FROM users WHERE id = ?',
            [userId]
        );
        if (existing.length > 0 && existing[0].profile_picture) {
            const oldFilename = path.basename(existing[0].profile_picture);
            const oldPath = path.join(__dirname, '../uploads/profiles', oldFilename);
            if (fs.existsSync(oldPath)) {
                try { fs.unlinkSync(oldPath); } catch (e) { /* ignore */ }
            }
        }

        await db.query(
            'UPDATE users SET profile_picture = NULL WHERE id = ?',
            [userId]
        );

        return res.json({ success: true, message: 'Profile picture removed.' });
    } catch (error) {
        console.error('removeProfilePicture error:', error.message);
        return res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

module.exports = {
    getMyProfile,
    updateProfile,
    changePassword,
    uploadProfilePicture,
    removeProfilePicture
};
