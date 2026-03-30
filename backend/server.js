// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const db = require('./config/db');
const path = require('path');

// Route imports
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const lecturerRoutes = require('./routes/lecturerRoutes');
const studentRoutes = require('./routes/studentRoutes');
const profileRoutes = require('./routes/profileRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// SELF-HEALING DATABASE MIGRATIONS (runs on startup)
// ============================================================
const runMigrations = async () => {
    try {
        // Add profile_picture column if it does not exist
        await db.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS profile_picture VARCHAR(500) DEFAULT NULL
        `).catch(() => {
            // MySQL < 8.0 does not support IF NOT EXISTS on ALTER
            // Try checking manually
            return db.query(`SHOW COLUMNS FROM users LIKE 'profile_picture'`).then(([rows]) => {
                if (rows.length === 0) {
                    return db.query(`ALTER TABLE users ADD COLUMN profile_picture VARCHAR(500) DEFAULT NULL`);
                }
            });
        });

        await db.query(`SHOW COLUMNS FROM users LIKE 'bio'`).then(([rows]) => {
            if (rows.length === 0) {
                return db.query(`ALTER TABLE users ADD COLUMN bio TEXT DEFAULT NULL`);
            }
        });

        await db.query(`SHOW COLUMNS FROM users LIKE 'phone'`).then(([rows]) => {
            if (rows.length === 0) {
                return db.query(`ALTER TABLE users ADD COLUMN phone VARCHAR(20) DEFAULT NULL`);
            }
        });

        // Create profile_pictures table if it does not exist
        await db.query(`
            CREATE TABLE IF NOT EXISTS profile_pictures (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL UNIQUE,
                file_name VARCHAR(255) NOT NULL,
                file_type VARCHAR(50) NOT NULL,
                file_size INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Create uploads directory
        const uploadsDir = require('path').join(__dirname, 'uploads', 'profiles');
        const fs = require('fs');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        console.log('✅ Database migrations completed successfully.');
    } catch (error) {
        console.error('❌ Migration error:', error.message);
    }
};

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors({
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3000', 'http://127.0.0.1:5501', 'http://localhost:5501', 'null'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static uploads (profile pictures)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ============================================================
// ROUTES
// ============================================================
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/lecturer', lecturerRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/profile', profileRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'University Results API is running.', timestamp: new Date() });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found.` });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ============================================================
// SEED DEFAULT ADMIN
// ============================================================
const seedAdmin = async () => {
    try {
        const [existing] = await db.query(
            'SELECT id FROM users WHERE email = ? AND role = ?',
            [process.env.ADMIN_EMAIL || 'admin@university.edu', 'admin']
        );
        if (existing.length === 0) {
            const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123', 12);
            await db.query(
                'INSERT INTO users (email, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)',
                [
                    process.env.ADMIN_EMAIL || 'admin@university.edu',
                    hashed,
                    process.env.ADMIN_FIRST_NAME || 'System',
                    process.env.ADMIN_LAST_NAME || 'Administrator',
                    'admin'
                ]
            );
            console.log('✅ Default admin account created.');
            console.log(`   Email: ${process.env.ADMIN_EMAIL || 'admin@university.edu'}`);
            console.log(`   Password: ${process.env.ADMIN_PASSWORD || 'Admin@123'}`);
        } else {
            console.log('ℹ️  Admin account already exists.');
        }
    } catch (error) {
        console.error('❌ Error seeding admin:', error.message);
    }
};

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, async () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`📋 API Health: http://localhost:${PORT}/api/health\n`);
    await runMigrations();
    await seedAdmin();
});
