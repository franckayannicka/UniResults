# 🎓 University Results Management System

A full-stack web application for managing university students, lecturers, courses, and academic results.

Built with:
- Node.js + Express (Backend API)
- MySQL (Database)
- HTML, CSS, JavaScript (Frontend)
---

## 🚀 Features

- 🔐 Authentication (Admin, Lecturer, Student)
- 🏫 Department & Course Management
- 👨‍🏫 Lecturer Assignment
- 👨‍🎓 Student Enrollment
- 📊 Results & GPA Calculation
- 📈 Dashboard for each role

---

## ⚙️ Installation

### 1. Clone the project
```bash
git clone https://github.com/franckayannicka/UniResults.git
cd UniResults
```

---

### 2. Setup Database
- Open MySQL / phpMyAdmin
- Run `database.sql`

---

### 3. Environment Variables

Create a `.env` file inside the `backend/` folder and add:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=university_results
PORT=5000
```

---

### 4. Setup Backend
```bash
cd backend
npm install
npm start
```

---

### 5. Run Frontend
```bash
cd frontend
npx http-server . -p 5500 
```

Open:
```
http://localhost:5500/login.html
```

---

## 🔑 Default Admin

A default admin account is automatically created when the server starts.

Check your backend console for credentials.

---

## 📡 API Overview

- Auth → `/api/auth`
- Admin → `/api/admin`
- Lecturer → `/api/lecturer`
- Student → `/api/student`

---

## 🛡️ Security

- Password hashing (bcrypt)
- JWT authentication
- Role-based access control
- SQL injection protection

---

## 📌 Author

👤 Tchikankou Kengne Franck Yannick 
GitHub: https://github.com/franckayannicka

---

## ⭐ Support

If you like this project, give it a star ⭐
