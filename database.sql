-- ============================================================
-- University Results Management System - Database Schema
-- Run this in your WAMPServer phpMyAdmin or MySQL console
-- ============================================================

CREATE DATABASE IF NOT EXISTS university_results CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE university_results;

-- ============================================================
-- DEPARTMENTS
-- ============================================================
CREATE TABLE departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    code VARCHAR(20) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- USERS (base table for all roles)
-- ============================================================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(191) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role ENUM('admin', 'lecturer', 'student') NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- STUDENTS
-- ============================================================
CREATE TABLE students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    matric_number VARCHAR(30) NOT NULL UNIQUE,
    department_id INT NOT NULL,
    level ENUM('100','200','300','400','500') DEFAULT '100',
    date_of_birth DATE,
    phone VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT
);

-- ============================================================
-- LECTURERS
-- ============================================================
CREATE TABLE lecturers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    staff_id VARCHAR(30) NOT NULL UNIQUE,
    department_id INT NOT NULL,
    title VARCHAR(50),
    phone VARCHAR(20),
    specialization VARCHAR(150),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT
);

-- ============================================================
-- COURSES
-- ============================================================
CREATE TABLE courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    department_id INT NOT NULL,
    course_code VARCHAR(20) NOT NULL UNIQUE,
    course_title VARCHAR(200) NOT NULL,
    credit_units INT NOT NULL DEFAULT 3,
    semester ENUM('first','second') NOT NULL DEFAULT 'first',
    level ENUM('100','200','300','400','500') DEFAULT '100',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT
);

-- ============================================================
-- LECTURER-COURSE ASSIGNMENTS
-- ============================================================
CREATE TABLE lecturer_courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lecturer_id INT NOT NULL,
    course_id INT NOT NULL,
    academic_year VARCHAR(20) NOT NULL DEFAULT '2024/2025',
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_assignment (lecturer_id, course_id, academic_year),
    FOREIGN KEY (lecturer_id) REFERENCES lecturers(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- ============================================================
-- ENROLLMENTS (students enrolled in courses)
-- ============================================================
CREATE TABLE enrollments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    course_id INT NOT NULL,
    academic_year VARCHAR(20) NOT NULL DEFAULT '2024/2025',
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_enrollment (student_id, course_id, academic_year),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- ============================================================
-- MARKS
-- ============================================================
CREATE TABLE marks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    course_id INT NOT NULL,
    lecturer_id INT NOT NULL,
    ca_score DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Continuous Assessment (max 40)',
    exam_score DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Exam Score (max 60)',
    total_score DECIMAL(5,2) GENERATED ALWAYS AS (ca_score + exam_score) STORED,
    grade VARCHAR(2) GENERATED ALWAYS AS (
        CASE
            WHEN (ca_score + exam_score) >= 70 THEN 'A'
            WHEN (ca_score + exam_score) >= 60 THEN 'B'
            WHEN (ca_score + exam_score) >= 50 THEN 'C'
            WHEN (ca_score + exam_score) >= 45 THEN 'D'
            WHEN (ca_score + exam_score) >= 40 THEN 'E'
            ELSE 'F'
        END
    ) STORED,
    academic_year VARCHAR(20) NOT NULL DEFAULT '2024/2025',
    remarks TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_mark (student_id, course_id, academic_year),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (lecturer_id) REFERENCES lecturers(id) ON DELETE CASCADE
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    table_affected VARCHAR(50),
    record_id INT,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);


-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_students_matric ON students(matric_number);
CREATE INDEX idx_courses_code ON courses(course_code);
CREATE INDEX idx_marks_student ON marks(student_id);
CREATE INDEX idx_marks_course ON marks(course_id);
CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_course ON enrollments(course_id);
