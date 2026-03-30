# 🎓 University Results Management System

A full-stack university results management system built with Node.js, Express, MySQL, and Vanilla JavaScript.

---

## 📁 Project Structure

```
university-results/
├── database.sql                  ← Run this first in MySQL
├── backend/
│   ├── .env                      ← Environment config
│   ├── package.json
│   ├── server.js                 ← Entry point
│   ├── config/
│   │   └── db.js                 ← MySQL connection pool
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── adminController.js
│   │   ├── lecturerController.js
│   │   └── studentController.js
│   ├── middleware/
│   │   └── auth.js               ← JWT + role middleware
│   └── routes/
│       ├── authRoutes.js
│       ├── adminRoutes.js
│       ├── lecturerRoutes.js
│       └── studentRoutes.js
└── frontend/
    ├── login.html
    ├── admin-dashboard.html
    ├── lecturer-dashboard.html
    ├── student-dashboard.html
    ├── css/
    │   ├── style.css             ← Dashboard styles
    │   └── login.css             ← Login page styles
    └── js/
        ├── utils.js              ← Shared utilities
        ├── admin.js
        ├── lecturer.js
        └── student.js
```

---

## ⚙️ Setup Instructions

### Step 1 — Create the Database

1. Open **phpMyAdmin** (WAMPServer) or MySQL console
2. Run the contents of `database.sql`
3. This creates the `university_results` database with all tables

### Step 2 — Configure the Backend

1. Navigate to the `backend/` folder
2. Open `.env` and confirm these settings match your WAMPServer setup:
   ```
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=        ← leave blank if no password set
   DB_NAME=university_results
   PORT=5000
   ```

### Step 3 — Install Dependencies & Start Backend

```bash
cd backend
npm install
npm start
```

Or for auto-restart during development:
```bash
npm run dev
```

You should see:
```
🚀 Server running on http://localhost:5000
✅ MySQL connected successfully
✅ Default admin account created.
   Email: admin@university.edu
   Password: Admin@123
```

### Step 4 — Serve the Frontend

**Option A — VS Code Live Server (recommended)**
- Install the "Live Server" extension in VS Code
- Right-click `frontend/login.html` → Open with Live Server
- It will open at `http://localhost:5500`

**Option B — Python simple server**
```bash
cd frontend
python -m http.server 5500
```
Then visit: `http://localhost:5500/login.html`

**Option C — Open directly in browser**
- Just double-click `login.html` in your file manager
- Note: Some browsers may have CORS issues with `file://` protocol
- In that case, use Option A or B

---

## 🔑 Default Login

| Role     | Email                      | Password   |
|----------|----------------------------|------------|
| Admin    | admin@university.edu       | Admin@123  |

> Lecturer and student accounts are created by the admin.

---

## 🚀 Testing the Full Workflow

Follow these steps in order to test the complete system:

### 1. Login as Admin
- Go to `http://localhost:5500/login.html`
- Use: `admin@university.edu` / `Admin@123`

### 2. Create a Department
- Go to **Departments** → Fill in name and code → Click Create

### 3. Register a Lecturer
- Go to **Lecturers** → Fill in all fields → Register
- Example: email: `dr.smith@university.edu`, password: `Pass@123`

### 4. Register a Student
- Go to **Students** → Fill in all fields → Register
- Example: email: `john.doe@student.edu`, password: `Pass@123`, matric: `UNI/2024/001`

### 5. Create a Course
- Go to **Courses** → Fill in course code, title, department → Create

### 6. Assign Course to Lecturer
- Go to **Assign Courses** → Select lecturer + course → Assign

### 7. Enroll Student in Course
- Go to **Enroll Students** → Select student + course → Enroll

### 8. Login as Lecturer
- Logout, then login with lecturer credentials
- Go to **Upload Marks** → Select course → Add marks for students

### 9. Login as Student
- Logout, then login with student credentials
- View **My Courses**, **My Results**, and **GPA Summary**

---

## 📡 API Endpoints Reference

### Auth
| Method | Endpoint           | Description      |
|--------|--------------------|------------------|
| POST   | /api/auth/login    | Login            |
| GET    | /api/auth/me       | Get current user |

### Admin (requires admin JWT)
| Method | Endpoint                        | Description              |
|--------|---------------------------------|--------------------------|
| GET    | /api/admin/dashboard-summary    | Stats overview           |
| POST   | /api/admin/create-department    | Create department        |
| GET    | /api/admin/departments          | List all departments     |
| POST   | /api/admin/register-student     | Register student         |
| GET    | /api/admin/students             | List all students        |
| POST   | /api/admin/register-lecturer    | Register lecturer        |
| GET    | /api/admin/lecturers            | List all lecturers       |
| POST   | /api/admin/create-course        | Create course            |
| GET    | /api/admin/courses              | List all courses         |
| POST   | /api/admin/assign-course        | Assign course to lecturer|
| POST   | /api/admin/enroll-student       | Enroll student in course |
| GET    | /api/admin/users                | All users directory      |

### Lecturer (requires lecturer JWT)
| Method | Endpoint                                | Description               |
|--------|-----------------------------------------|---------------------------|
| GET    | /api/lecturer/my-courses                | Courses assigned to me    |
| GET    | /api/lecturer/course-students/:courseId | Students in a course      |
| POST   | /api/lecturer/upload-marks              | Upload marks              |
| PUT    | /api/lecturer/update-marks              | Update existing marks     |

### Student (requires student JWT)
| Method | Endpoint                  | Description             |
|--------|---------------------------|-------------------------|
| GET    | /api/student/profile      | Student profile         |
| GET    | /api/student/my-courses   | Enrolled courses        |
| GET    | /api/student/my-results   | Marks/results           |
| GET    | /api/student/gpa-summary  | GPA and classification  |

---

## 🎓 Grading Scale

| Score     | Grade | Grade Points | Classification          |
|-----------|-------|--------------|-------------------------|
| 70–100    | A     | 5.0          | —                       |
| 60–69     | B     | 4.0          | —                       |
| 50–59     | C     | 3.0          | —                       |
| 45–49     | D     | 2.0          | —                       |
| 40–44     | E     | 1.0          | —                       |
| 0–39      | F     | 0.0          | —                       |

| GPA Range | Classification         |
|-----------|------------------------|
| 4.5–5.0   | First Class Honours    |
| 3.5–4.49  | Second Class Upper     |
| 2.5–3.49  | Second Class Lower     |
| 1.5–2.49  | Third Class            |
| 1.0–1.49  | Pass                   |
| 0–0.99    | Fail                   |

---

## 🔧 Common Issues & Fixes

**"Cannot connect to server"**
→ Make sure you ran `npm start` in the `backend/` folder and it shows port 5000.

**"MySQL connection failed"**
→ Check that WAMPServer is running (green icon in system tray). Verify `.env` DB credentials.

**"CORS error in browser"**
→ Don't open HTML files via `file://`. Use Live Server or `python -m http.server 5500`.

**"Token expired"**
→ Simply log out and log back in. Token lasts 24 hours by default.

**Tables already exist error in SQL**
→ The schema uses `CREATE TABLE IF NOT EXISTS` equivalents. If you see issues, drop the `university_results` database and re-run `database.sql`.

---

## 🛡️ Security Notes

- All passwords are hashed with bcrypt (12 rounds)
- JWT tokens expire in 24 hours
- All SQL queries use parameterized inputs (no injection risk)
- Role-based middleware protects every route
- Students can only see their own data
- Lecturers can only upload marks for their assigned courses
