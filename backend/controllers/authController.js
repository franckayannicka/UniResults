// backend/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
require('dotenv').config();

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required.' });
        }

        // Fetch user by email
        const [users] = await db.query(
            `SELECT u.id, u.email, u.password, u.first_name, u.last_name, u.role, u.is_active
             FROM users u WHERE u.email = ? LIMIT 1`,
            [email.trim().toLowerCase()]
        );

        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        const user = users[0];

        if (!user.is_active) {
            return res.status(403).json({ success: false, message: 'Account is deactivated. Contact admin.' });
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        // Get role-specific profile ID
        let profileId = null;
        let profileData = {};

        if (user.role === 'student') {
            const [students] = await db.query(
                `SELECT s.id, s.matric_number, s.level, d.name as department_name
                 FROM students s JOIN departments d ON s.department_id = d.id
                 WHERE s.user_id = ?`,
                [user.id]
            );
            if (students.length > 0) {
                profileId = students[0].id;
                profileData = students[0];
            }
        } else if (user.role === 'lecturer') {
            const [lecturers] = await db.query(
                `SELECT l.id, l.staff_id, l.title, d.name as department_name
                 FROM lecturers l JOIN departments d ON l.department_id = d.id
                 WHERE l.user_id = ?`,
                [user.id]
            );
            if (lecturers.length > 0) {
                profileId = lecturers[0].id;
                profileData = lecturers[0];
            }
        }

        // Build JWT payload
        const payload = {
            userId: user.id,
            profileId,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN || '24h'
        });

        // Log login action
        await db.query(
            `INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)`,
            [user.id, 'LOGIN', `User ${user.email} logged in`, req.ip]
        );

        return res.status(200).json({
            success: true,
            message: 'Login successful.',
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                profileId,
                ...profileData
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ success: false, message: 'Server error during login.' });
    }
};

/**
 * GET /api/auth/me
 * Get current user info
 */
const getMe = async (req, res) => {
    try {
        const [users] = await db.query(
            `SELECT id, email, first_name, last_name, role, created_at FROM users WHERE id = ?`,
            [req.user.userId]
        );
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        return res.json({ success: true, user: users[0] });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

module.exports = { login, getMe };
