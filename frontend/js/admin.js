// frontend/js/admin.js

let cachedStudents = [];
let cachedLecturers = [];
let cachedCourses = [];
let cachedDepartments = [];
let cachedEnrollments = [];
let cachedAssignments = [];
let cachedUsers = [];
let cachedFullResults = [];
let confirmActionHandler = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Auth check
    const user = requireAuth('admin');
    if (!user) return;

    // Populate sidebar
    populateSidebarUser(user);

    // Load profile picture on init
    apiFetch('/profile/me').then(res => {
        if (res && res.data.success && res.data.profile.profile_picture) {
            updateSidebarAvatar(res.data.profile.profile_picture, user.firstName, user.lastName);
            updateTopbarAvatar(res.data.profile.profile_picture, user.firstName, user.lastName);
        }
    });

    // Init navigation
    initNav('dashboard');

    // Update topbar title on nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const titles = {
                dashboard: 'Dashboard', departments: 'Departments',
                students: 'Students', lecturers: 'Lecturers', courses: 'Courses',
                assign: 'Assign Courses', enroll: 'Enroll Students', users: 'All Users',
                enrollments: 'Enrollments', assignments: 'Assignments', profile: 'My Profile'
            };
            const t = item.dataset.page;
            if (titles[t]) document.getElementById('topbarTitle').textContent = titles[t];
        });
    });

    // Load initial data
    await loadDashboardSummary();
    await loadDepartments();

    // Setup forms
    setupDeptForm();
    setupStudentForm();
    setupLecturerForm();
    setupCourseForm();
    setupAssignForm();
    setupEnrollForm();

    // Page-specific loaders triggered on nav
    document.querySelector('[data-page="students"]').addEventListener('click', () => {
        loadStudents();
        refreshDeptSelect('studentDeptSelect');
    });
    document.querySelector('[data-page="lecturers"]').addEventListener('click', () => {
        loadLecturers();
        refreshDeptSelect('lecturerDeptSelect');
    });
    document.querySelector('[data-page="courses"]').addEventListener('click', () => {
        loadCourses();
        refreshDeptSelect('courseDeptSelect');
    });
    document.querySelector('[data-page="assign"]').addEventListener('click', () => {
        refreshLecturerSelect('assignLecturerSelect');
        refreshCourseSelect('assignCourseSelect');
    });
    document.querySelector('[data-page="enroll"]').addEventListener('click', () => {
        refreshStudentSelect('enrollStudentSelect');
        refreshCourseSelect('enrollCourseSelect');
    });
    document.querySelector('[data-page="users"]').addEventListener('click', loadUsers);
    document.querySelector('[data-page="enrollments"]').addEventListener('click', loadEnrollments);
    document.querySelector('[data-page="assignments"]').addEventListener('click', loadAssignments);
    document.querySelector('[data-page="profile"]').addEventListener('click', () => {
        document.getElementById('topbarTitle').textContent = 'My Profile';
        loadProfilePage();
    });

    const topbarAvatar = document.getElementById('topbarAvatar');
    if (topbarAvatar) {
        topbarAvatar.addEventListener('click', () => {
            document.getElementById('topbarTitle').textContent = 'My Profile';
            loadProfilePage();
        });
    }
});

// ============================================================
// DASHBOARD SUMMARY
// ============================================================
async function loadDashboardSummary() {
    const res = await apiFetch('/admin/dashboard-summary');
    if (!res || !res.data.success) return;
    const s = res.data.summary;
    document.getElementById('statStudents').textContent = s.students;
    document.getElementById('statLecturers').textContent = s.lecturers;
    document.getElementById('statCourses').textContent = s.courses;
    document.getElementById('statDepartments').textContent = s.departments;
    document.getElementById('statEnrollments').textContent = s.enrollments;
    document.getElementById('statMarks').textContent = s.marks;
}

function showConfirm(message, callback, actionLabel = 'Delete') {
    confirmActionHandler = callback;
    document.getElementById('confirmMessage').textContent = message;
    const btn = document.getElementById('confirmActionBtn');
    btn.textContent = actionLabel;
    btn.onclick = () => {
        if (typeof confirmActionHandler === 'function') confirmActionHandler();
        closeModal('confirmModal');
    };
    openModal('confirmModal');
}

// ============================================================
// DEPARTMENTS
// ============================================================
async function loadDepartments() {
    const res = await apiFetch('/admin/departments');
    const tbody = document.getElementById('deptTableBody');
    if (!res || !res.data.success) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--danger);padding:24px;">Failed to load departments.</td></tr>`;
        return;
    }
    const depts = res.data.departments;
    cachedDepartments = depts;
    if (depts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px;">No departments yet.</td></tr>`;
        return;
    }
    tbody.innerHTML = depts.map(d => `
        <tr>
            <td><span class="badge badge-gold">${d.code}</span></td>
            <td style="color:var(--text-primary);font-weight:500;">${d.name}</td>
            <td style="font-size:12px;color:var(--text-muted);">${d.created_at ? d.created_at.split('T')[0] : ''}</td>
            <td>
                <button class="btn btn-outline btn-sm" onclick="openDeptEditModal(${d.id})">✏️ Edit</button>
                <button class="btn btn-danger btn-sm" onclick="confirmDeleteDepartment(${d.id})">🗑️ Delete</button>
            </td>
        </tr>
    `).join('');
}

function setupDeptForm() {
    document.getElementById('deptForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        setButtonLoading('deptBtn', true, 'Create Department');
        const res = await apiFetch('/admin/create-department', { method: 'POST', body: JSON.stringify(data) });
        setButtonLoading('deptBtn', false, 'Create Department');
        if (!res) return;
        if (res.data.success) {
            showToast('success', 'Department Created', res.data.message);
            e.target.reset();
            loadDepartments();
            loadDashboardSummary();
        } else {
            showToast('error', 'Error', res.data.message);
        }
    });
}

// ============================================================
// STUDENTS
// ============================================================
async function loadStudents() {
    const res = await apiFetch('/admin/students');
    const tbody = document.getElementById('studentsTableBody');
    if (!res || !res.data.success) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--danger);padding:24px;">Failed to load students.</td></tr>`;
        return;
    }
    const students = res.data.students;
    cachedStudents = students;
    if (students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px;">No students registered yet.</td></tr>`;
        return;
    }
    tbody.innerHTML = students.map(s => `
        <tr>
            <td><code style="color:var(--gold);font-size:12px;">${s.matric_number}</code></td>
            <td style="color:var(--text-primary);font-weight:500;">${s.last_name}, ${s.first_name}</td>
            <td style="font-size:12px;">${s.department_name}</td>
            <td><span class="badge badge-teal">${s.level}L</span></td>
            <td>
                <button class="btn btn-outline btn-sm" onclick="openStudentEditModal(${s.id})">✏️ Edit</button>
                <button class="btn btn-danger btn-sm" onclick="toggleUserStatus(${s.user_id})">${s.is_active ? '🚫 Deactivate' : '✅ Activate'}</button>
            </td>
        </tr>
    `).join('');
}

function setupStudentForm() {
    refreshDeptSelect('studentDeptSelect');
    document.getElementById('studentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        setButtonLoading('studentBtn', true, 'Register Student');
        const res = await apiFetch('/admin/register-student', { method: 'POST', body: JSON.stringify(data) });
        setButtonLoading('studentBtn', false, 'Register Student');
        if (!res) return;
        if (res.data.success) {
            showToast('success', 'Student Registered', `Account created successfully.`);
            e.target.reset();
            loadStudents();
            loadDashboardSummary();
        } else {
            showToast('error', 'Registration Failed', res.data.message);
        }
    });
}

// ============================================================
// LECTURERS
// ============================================================
async function loadLecturers() {
    const res = await apiFetch('/admin/lecturers');
    const tbody = document.getElementById('lecturersTableBody');
    if (!res || !res.data.success) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--danger);padding:24px;">Failed to load lecturers.</td></tr>`;
        return;
    }
    const lecturers = res.data.lecturers;
    cachedLecturers = lecturers;
    if (lecturers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px;">No lecturers registered yet.</td></tr>`;
        return;
    }
    tbody.innerHTML = lecturers.map(l => `
        <tr>
            <td><code style="color:var(--teal);font-size:12px;">${l.staff_id}</code></td>
            <td style="color:var(--text-primary);font-weight:500;">${l.title || ''} ${l.last_name}, ${l.first_name}</td>
            <td style="font-size:12px;">${l.department_name}</td>
            <td style="font-size:12px;color:var(--text-muted);">${l.specialization || '—'}</td>
            <td>
                <button class="btn btn-outline btn-sm" onclick="openLecturerEditModal(${l.id})">✏️ Edit</button>
                <button class="btn btn-danger btn-sm" onclick="toggleUserStatus(${l.user_id})">${l.is_active ? '🚫 Deactivate' : '✅ Activate'}</button>
            </td>
        </tr>
    `).join('');
}

function setupLecturerForm() {
    refreshDeptSelect('lecturerDeptSelect');
    document.getElementById('lecturerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        setButtonLoading('lecturerBtn', true, 'Register Lecturer');
        const res = await apiFetch('/admin/register-lecturer', { method: 'POST', body: JSON.stringify(data) });
        setButtonLoading('lecturerBtn', false, 'Register Lecturer');
        if (!res) return;
        if (res.data.success) {
            showToast('success', 'Lecturer Registered', `Account created successfully.`);
            e.target.reset();
            loadLecturers();
            loadDashboardSummary();
        } else {
            showToast('error', 'Registration Failed', res.data.message);
        }
    });
}

// ============================================================
// COURSES
// ============================================================
async function loadCourses() {
    const res = await apiFetch('/admin/courses');
    const tbody = document.getElementById('coursesTableBody');
    if (!res || !res.data.success) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--danger);padding:24px;">Failed to load courses.</td></tr>`;
        return;
    }
    const courses = res.data.courses;
    cachedCourses = courses;
    if (courses.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px;">No courses created yet.</td></tr>`;
        return;
    }
    tbody.innerHTML = courses.map(c => `
        <tr>
            <td><span class="badge badge-gold">${c.course_code}</span></td>
            <td style="color:var(--text-primary);font-weight:500;">${c.course_title}</td>
            <td style="font-size:12px;">${c.department_name}</td>
            <td style="text-align:center;">${c.credit_units}</td>
            <td><span class="badge badge-muted">${c.semester}</span></td>
            <td><span class="badge badge-teal">${c.level}L</span></td>
            <td>
                <button class="btn btn-outline btn-sm" onclick="openCourseEditModal(${c.id})">✏️ Edit</button>
                <button class="btn btn-danger btn-sm" onclick="confirmDeleteCourse(${c.id})">🗑️ Delete</button>
            </td>
        </tr>
    `).join('');
}

function setupCourseForm() {
    refreshDeptSelect('courseDeptSelect');
    document.getElementById('courseForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        setButtonLoading('courseBtn', true, 'Create Course');
        const res = await apiFetch('/admin/create-course', { method: 'POST', body: JSON.stringify(data) });
        setButtonLoading('courseBtn', false, 'Create Course');
        if (!res) return;
        if (res.data.success) {
            showToast('success', 'Course Created', res.data.message);
            e.target.reset();
            loadCourses();
            loadDashboardSummary();
        } else {
            showToast('error', 'Error', res.data.message);
        }
    });
}

// ============================================================
// ASSIGN FORM
// ============================================================
function setupAssignForm() {
    document.getElementById('assignForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        setButtonLoading('assignBtn', true, 'Assign Course');
        const res = await apiFetch('/admin/assign-course', { method: 'POST', body: JSON.stringify(data) });
        setButtonLoading('assignBtn', false, 'Assign Course');
        if (!res) return;
        if (res.data.success) {
            showToast('success', 'Course Assigned', res.data.message);
            e.target.reset();
        } else {
            showToast('error', 'Error', res.data.message);
        }
    });
}

// ============================================================
// ENROLL FORM
// ============================================================
function setupEnrollForm() {
    document.getElementById('enrollForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        setButtonLoading('enrollBtn', true, 'Enroll Student');
        const res = await apiFetch('/admin/enroll-student', { method: 'POST', body: JSON.stringify(data) });
        setButtonLoading('enrollBtn', false, 'Enroll Student');
        if (!res) return;
        if (res.data.success) {
            showToast('success', 'Student Enrolled', res.data.message);
            e.target.reset();
            loadDashboardSummary();
        } else {
            showToast('error', 'Error', res.data.message);
        }
    });
}

// ============================================================
// ALL USERS
// ============================================================
async function loadUsers() {
    const res = await apiFetch('/admin/users');
    const tbody = document.getElementById('usersTableBody');
    if (!res || !res.data.success) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--danger);padding:24px;">Failed to load users.</td></tr>`;
        return;
    }
    const users = res.data.users;
    cachedUsers = users;
    tbody.innerHTML = users.map(u => `
        <tr>
            <td style="color:var(--text-primary);font-weight:500;">${u.first_name} ${u.last_name}</td>
            <td style="font-size:12px;color:var(--text-secondary);">${u.email}</td>
            <td>${getRoleBadge(u.role)}</td>
            <td><code style="font-size:11px;color:var(--gold);">${u.identifier || '—'}</code></td>
            <td style="font-size:12px;">${u.department_name || '—'}</td>
            <td>${u.is_active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Inactive</span>'}</td>
            <td style="font-size:11px;color:var(--text-muted);">${u.created_at ? u.created_at.split('T')[0] : ''}</td>
            <td><button class="btn btn-outline btn-sm" onclick="openResetPasswordModal(${u.id}, '${(u.email || '').replace(/'/g, "\\'")}')">🔑 Reset</button></td>
        </tr>
    `).join('');
}

// ============================================================
// SELECT REFRESH HELPERS
// ============================================================
async function refreshDeptSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const res = await apiFetch('/admin/departments');
    if (!res || !res.data.success) return;
    const current = select.value;
    select.innerHTML = '<option value="">-- Select Department --</option>';
    res.data.departments.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = `${d.code} - ${d.name}`;
        select.appendChild(opt);
    });
    if (current) select.value = current;
}

async function refreshLecturerSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const res = await apiFetch('/admin/lecturers');
    if (!res || !res.data.success) return;
    select.innerHTML = '<option value="">-- Select Lecturer --</option>';
    res.data.lecturers.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.id;
        opt.textContent = `${l.title || ''} ${l.first_name} ${l.last_name} (${l.staff_id})`.trim();
        select.appendChild(opt);
    });
}

async function refreshCourseSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const res = await apiFetch('/admin/courses');
    if (!res || !res.data.success) return;
    select.innerHTML = '<option value="">-- Select Course --</option>';
    res.data.courses.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.course_code} - ${c.course_title}`;
        select.appendChild(opt);
    });
}

async function refreshStudentSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const res = await apiFetch('/admin/students');
    if (!res || !res.data.success) return;
    select.innerHTML = '<option value="">-- Select Student --</option>';
    res.data.students.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.last_name}, ${s.first_name} (${s.matric_number})`;
        select.appendChild(opt);
    });
}

// ============================================================
// AUTO-GENERATE IDS
// ============================================================
function setupAutoGenerators() {
    const matricBtn = document.getElementById('autoMatricBtn');
    if (matricBtn) matricBtn.addEventListener('click', handleAutoMatric);
    const staffBtn = document.getElementById('autoStaffBtn');
    if (staffBtn) staffBtn.addEventListener('click', handleAutoStaffId);
}

async function handleAutoMatric() {
    const deptId = document.getElementById('studentDeptSelect').value;
    if (!deptId) {
        showToast('info', 'Select Department', 'Please select a department first before generating an ID.');
        return;
    }
    toggleMiniSpinner('autoMatricBtn', 'autoMatricSpinner', true);
    const academicYear = new Date().getFullYear();
    const res = await apiFetch(`/admin/generate-matric?department_id=${deptId}&academic_year=${academicYear}`);
    toggleMiniSpinner('autoMatricBtn', 'autoMatricSpinner', false);
    if (res && res.data.success) {
        document.getElementById('matricNumber').value = res.data.matric_number;
        showToast('success', 'Matric Generated', 'You can still edit if needed.');
    } else {
        showToast('error', 'Error', res?.data?.message || 'Could not generate matric number.');
    }
}

async function handleAutoStaffId() {
    const deptId = document.getElementById('lecturerDeptSelect').value;
    if (!deptId) {
        showToast('info', 'Select Department', 'Please select a department first before generating an ID.');
        return;
    }
    toggleMiniSpinner('autoStaffBtn', 'autoStaffSpinner', true);
    const res = await apiFetch(`/admin/generate-staff-id?department_id=${deptId}`);
    toggleMiniSpinner('autoStaffBtn', 'autoStaffSpinner', false);
    if (res && res.data.success) {
        document.getElementById('staffId').value = res.data.staff_id;
        showToast('success', 'Staff ID Generated', 'You can still edit if needed.');
    } else {
        showToast('error', 'Error', res?.data?.message || 'Could not generate staff ID.');
    }
}

function toggleMiniSpinner(btnId, spinnerId, isLoading) {
    const btn = document.getElementById(btnId);
    const spinner = document.getElementById(spinnerId);
    if (!btn || !spinner) return;
    btn.disabled = isLoading;
    spinner.style.display = isLoading ? 'inline-block' : 'none';
}

// ============================================================
// EDIT MODALS SETUP
// ============================================================
function setupEditForms() {
    const studentEditForm = document.getElementById('studentEditForm');
    if (studentEditForm) {
        studentEditForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('editStudentId').value;
            const payload = {
                first_name: document.getElementById('editStudentFirst').value,
                last_name: document.getElementById('editStudentLast').value,
                email: document.getElementById('editStudentEmail').value,
                level: document.getElementById('editStudentLevel').value,
                phone: document.getElementById('editStudentPhone').value,
                department_id: document.getElementById('editStudentDept').value
            };
            setButtonLoading('studentEditSubmit', true, 'Save Changes');
            const res = await apiFetch(`/admin/update-student/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
            setButtonLoading('studentEditSubmit', false, 'Save Changes');
            if (!res) return;
            if (res.data.success) {
                showToast('success', 'Student Updated', 'Changes saved.');
                closeModal('studentEditModal');
                loadStudents();
            } else {
                showToast('error', 'Error', res.data.message);
            }
        });
    }

    const lecturerEditForm = document.getElementById('lecturerEditForm');
    if (lecturerEditForm) {
        lecturerEditForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('editLecturerId').value;
            const payload = {
                title: document.getElementById('editLecturerTitle').value,
                first_name: document.getElementById('editLecturerFirst').value,
                last_name: document.getElementById('editLecturerLast').value,
                email: document.getElementById('editLecturerEmail').value,
                phone: document.getElementById('editLecturerPhone').value,
                specialization: document.getElementById('editLecturerSpec').value,
                department_id: document.getElementById('editLecturerDept').value
            };
            setButtonLoading('lecturerEditSubmit', true, 'Save Changes');
            const res = await apiFetch(`/admin/update-lecturer/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
            setButtonLoading('lecturerEditSubmit', false, 'Save Changes');
            if (!res) return;
            if (res.data.success) {
                showToast('success', 'Lecturer Updated', 'Changes saved.');
                closeModal('lecturerEditModal');
                loadLecturers();
            } else {
                showToast('error', 'Error', res.data.message);
            }
        });
    }

    const courseEditForm = document.getElementById('courseEditForm');
    if (courseEditForm) {
        courseEditForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('editCourseId').value;
            const payload = {
                course_title: document.getElementById('editCourseTitle').value,
                credit_units: document.getElementById('editCourseUnits').value,
                semester: document.getElementById('editCourseSemester').value,
                level: document.getElementById('editCourseLevel').value,
                description: document.getElementById('editCourseDesc').value
            };
            setButtonLoading('courseEditSubmit', true, 'Save Changes');
            const res = await apiFetch(`/admin/update-course/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
            setButtonLoading('courseEditSubmit', false, 'Save Changes');
            if (!res) return;
            if (res.data.success) {
                showToast('success', 'Course Updated', 'Changes saved.');
                closeModal('courseEditModal');
                loadCourses();
            } else {
                showToast('error', 'Error', res.data.message);
            }
        });
    }

    const deptEditForm = document.getElementById('deptEditForm');
    if (deptEditForm) {
        deptEditForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('editDeptId').value;
            const payload = {
                name: document.getElementById('editDeptName').value,
                description: document.getElementById('editDeptDesc').value
            };
            setButtonLoading('deptEditSubmit', true, 'Save Changes');
            const res = await apiFetch(`/admin/update-department/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
            setButtonLoading('deptEditSubmit', false, 'Save Changes');
            if (!res) return;
            if (res.data.success) {
                showToast('success', 'Department Updated', 'Changes saved.');
                closeModal('deptEditModal');
                loadDepartments();
                refreshDeptSelect('studentDeptSelect');
                refreshDeptSelect('lecturerDeptSelect');
                refreshDeptSelect('courseDeptSelect');
            } else {
                showToast('error', 'Error', res.data.message);
            }
        });
    }

    const resetPasswordForm = document.getElementById('resetPasswordForm');
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userId = document.getElementById('resetUserId').value;
            const new_password = document.getElementById('resetNewPassword').value;
            setButtonLoading('resetPasswordSubmit', true, 'Update Password');
            const res = await apiFetch(`/admin/reset-password/${userId}`, { method: 'PUT', body: JSON.stringify({ new_password }) });
            setButtonLoading('resetPasswordSubmit', false, 'Update Password');
            if (!res) return;
            if (res.data.success) {
                showToast('success', 'Password Reset', 'Password updated successfully.');
                closeModal('resetPasswordModal');
            } else {
                showToast('error', 'Error', res.data.message);
            }
        });
    }
}

// ============================================================
// MODAL OPENERS
// ============================================================
async function openStudentEditModal(studentId) {
    const res = await apiFetch(`/admin/student/${studentId}`);
    if (!res || !res.data.success) {
        showToast('error', 'Error', 'Could not load student details.');
        return;
    }
    const s = res.data.student;
    await refreshDeptSelect('editStudentDept');
    document.getElementById('editStudentId').value = s.id;
    document.getElementById('editStudentFirst').value = s.first_name;
    document.getElementById('editStudentLast').value = s.last_name;
    document.getElementById('editStudentEmail').value = s.email;
    document.getElementById('editStudentLevel').value = s.level || '100';
    document.getElementById('editStudentPhone').value = s.phone || '';
    document.getElementById('editStudentDept').value = s.department_id;
    openModal('studentEditModal');
}

async function openLecturerEditModal(lecturerId) {
    const res = await apiFetch(`/admin/lecturer/${lecturerId}`);
    if (!res || !res.data.success) {
        showToast('error', 'Error', 'Could not load lecturer details.');
        return;
    }
    const l = res.data.lecturer;
    await refreshDeptSelect('editLecturerDept');
    document.getElementById('editLecturerId').value = l.id;
    document.getElementById('editLecturerTitle').value = l.title || '';
    document.getElementById('editLecturerFirst').value = l.first_name;
    document.getElementById('editLecturerLast').value = l.last_name;
    document.getElementById('editLecturerEmail').value = l.email;
    document.getElementById('editLecturerPhone').value = l.phone || '';
    document.getElementById('editLecturerSpec').value = l.specialization || '';
    document.getElementById('editLecturerDept').value = l.department_id;
    openModal('lecturerEditModal');
}

function openCourseEditModal(courseId) {
    const course = cachedCourses.find(c => c.id == courseId);
    if (!course) {
        loadCourses();
        showToast('info', 'Loading', 'Fetching course details...');
        return;
    }
    document.getElementById('editCourseId').value = course.id;
    document.getElementById('editCourseTitle').value = course.course_title;
    document.getElementById('editCourseUnits').value = course.credit_units;
    document.getElementById('editCourseSemester').value = course.semester;
    document.getElementById('editCourseLevel').value = course.level;
    document.getElementById('editCourseDesc').value = course.description || '';
    openModal('courseEditModal');
}

function openDeptEditModal(deptId) {
    const dept = cachedDepartments.find(d => d.id == deptId);
    if (!dept) {
        loadDepartments();
        return;
    }
    document.getElementById('editDeptId').value = dept.id;
    document.getElementById('editDeptName').value = dept.name;
    document.getElementById('editDeptDesc').value = dept.description || '';
    openModal('deptEditModal');
}

function openResetPasswordModal(userId, email) {
    document.getElementById('resetUserId').value = userId;
    const input = document.getElementById('resetNewPassword');
    input.value = '';
    input.placeholder = `New password for ${email}`;
    openModal('resetPasswordModal');
}

// ============================================================
// TOGGLES & DELETES
// ============================================================
function toggleUserStatus(userId) {
    const user = cachedUsers.find(u => u.id === userId);
    const isActive = user ? user.is_active === 1 || user.is_active === true : true;
    showConfirm(isActive ? 'Deactivate this user? They will no longer be able to sign in.' : 'Activate this user?', async () => {
        const res = await apiFetch(`/admin/delete-user/${userId}`, { method: 'DELETE' });
        if (!res) return;
        if (res.data.success) {
            showToast('success', 'User Status Updated', res.data.message);
            loadUsers();
            loadStudents();
            loadLecturers();
        } else {
            showToast('error', 'Error', res.data.message);
        }
    }, isActive ? 'Deactivate' : 'Activate');
}

function confirmDeleteCourse(courseId) {
    showConfirm('Delete this course? This cannot be undone.', async () => {
        const res = await apiFetch(`/admin/delete-course/${courseId}`, { method: 'DELETE' });
        if (!res) return;
        if (res.data.success) {
            showToast('success', 'Course Deleted', res.data.message);
            loadCourses();
        } else {
            showToast('error', 'Error', res.data.message);
        }
    });
}

function confirmDeleteDepartment(deptId) {
    showConfirm('Delete this department? Courses under it must be removed first.', async () => {
        const res = await apiFetch(`/admin/delete-department/${deptId}`, { method: 'DELETE' });
        if (!res) return;
        if (res.data.success) {
            showToast('success', 'Department Deleted', res.data.message);
            loadDepartments();
            refreshDeptSelect('studentDeptSelect');
            refreshDeptSelect('lecturerDeptSelect');
            refreshDeptSelect('courseDeptSelect');
        } else {
            showToast('error', 'Error', res.data.message);
        }
    });
}

function confirmDeleteEnrollment(enrollmentId) {
    showConfirm('Remove this enrollment?', async () => {
        const res = await apiFetch(`/admin/delete-enrollment/${enrollmentId}`, { method: 'DELETE' });
        if (!res) return;
        if (res.data.success) {
            showToast('success', 'Enrollment Deleted', res.data.message);
            loadEnrollments();
        } else {
            showToast('error', 'Error', res.data.message);
        }
    });
}

function confirmDeleteAssignment(assignmentId) {
    showConfirm('Remove this assignment?', async () => {
        const res = await apiFetch(`/admin/delete-assignment/${assignmentId}`, { method: 'DELETE' });
        if (!res) return;
        if (res.data.success) {
            showToast('success', 'Assignment Deleted', res.data.message);
            loadAssignments();
        } else {
            showToast('error', 'Error', res.data.message);
        }
    });
}

// ============================================================
// ENROLLMENTS & ASSIGNMENTS LISTS
// ============================================================
async function loadEnrollments() {
    const tbody = document.getElementById('enrollmentsTableBody');
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;"><div class="inline-loader"><div class="spinner"></div><span>Loading...</span></div></td></tr>`;
    const res = await apiFetch('/admin/enrollments');
    if (!res || !res.data.success) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--danger);padding:24px;">Failed to load enrollments.</td></tr>`;
        return;
    }
    const enrollments = res.data.enrollments;
    cachedEnrollments = enrollments;
    if (enrollments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px;">No enrollments yet.</td></tr>`;
        return;
    }
    tbody.innerHTML = enrollments.map(e => `
        <tr>
            <td>${e.student_name}</td>
            <td><code style="color:var(--gold);font-size:11px;">${e.matric_number}</code></td>
            <td><span class="badge badge-gold">${e.course_code}</span> ${e.course_title}</td>
            <td><span class="badge badge-muted">${e.academic_year}</span></td>
            <td><button class="btn btn-danger btn-sm" onclick="confirmDeleteEnrollment(${e.id})">🗑️ Delete</button></td>
        </tr>
    `).join('');
}

async function loadAssignments() {
    const tbody = document.getElementById('assignmentsTableBody');
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;"><div class="inline-loader"><div class="spinner"></div><span>Loading...</span></div></td></tr>`;
    const res = await apiFetch('/admin/assignments');
    if (!res || !res.data.success) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--danger);padding:24px;">Failed to load assignments.</td></tr>`;
        return;
    }
    const assignments = res.data.assignments;
    cachedAssignments = assignments;
    if (assignments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px;">No assignments yet.</td></tr>`;
        return;
    }
    tbody.innerHTML = assignments.map(a => `
        <tr>
            <td><span class="badge badge-gold">${a.course_code}</span> ${a.course_title}</td>
            <td>${a.title ? a.title + ' ' : ''}${a.lecturer_name}</td>
            <td><span class="badge badge-muted">${a.academic_year}</span></td>
            <td><button class="btn btn-danger btn-sm" onclick="confirmDeleteAssignment(${a.id})">🗑️ Delete</button></td>
        </tr>
    `).join('');
}

// ============================================================
// PDF DOWNLOADS
// ============================================================
async function ensureStudentsCached() {
    if (cachedStudents.length === 0) {
        const res = await apiFetch('/admin/students');
        if (res && res.data.success) cachedStudents = res.data.students;
    }
}

async function ensureLecturersCached() {
    if (cachedLecturers.length === 0) {
        const res = await apiFetch('/admin/lecturers');
        if (res && res.data.success) cachedLecturers = res.data.lecturers;
    }
}

async function ensureCoursesCached() {
    if (cachedCourses.length === 0) {
        const res = await apiFetch('/admin/courses');
        if (res && res.data.success) cachedCourses = res.data.courses;
    }
}

async function downloadAllStudentsPDF() {
    await ensureStudentsCached();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const title = 'Student Directory Report';
    doc.setFontSize(16); doc.text(title, 14, 18);
    doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 26);
    const rows = cachedStudents.map(s => [s.matric_number, `${s.first_name} ${s.last_name}`, s.department_name, `${s.level} Level`, s.email]);
    doc.autoTable({ head: [['Matric Number', 'Full Name', 'Department', 'Level', 'Email']], body: rows, startY: 32 });
    doc.save(`students_report_${Date.now()}.pdf`);
    showToast('success', 'PDF Downloaded', 'Students report saved.');
}

async function downloadAllLecturersPDF() {
    await ensureLecturersCached();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Lecturers Report', 14, 18);
    doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 26);
    const rows = cachedLecturers.map(l => [l.staff_id, `${l.title || ''} ${l.first_name} ${l.last_name}`, l.department_name, l.specialization || '—', l.email]);
    doc.autoTable({ head: [['Staff ID', 'Name', 'Department', 'Specialization', 'Email']], body: rows, startY: 32 });
    doc.save(`lecturers_report_${Date.now()}.pdf`);
    showToast('success', 'PDF Downloaded', 'Lecturers report saved.');
}

async function downloadAllCoursesPDF() {
    await ensureCoursesCached();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Courses Report', 14, 18);
    doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 26);
    const rows = cachedCourses.map(c => [c.course_code, c.course_title, c.department_name, c.credit_units, c.semester, `${c.level} Level`, c.assigned_lecturer || '—']);
    doc.autoTable({ head: [['Course Code', 'Title', 'Department', 'Credits', 'Semester', 'Level', 'Assigned Lecturer']], body: rows, startY: 32 });
    doc.save(`courses_report_${Date.now()}.pdf`);
    showToast('success', 'PDF Downloaded', 'Courses report saved.');
}

async function downloadFullResultsPDF() {
    if (cachedFullResults.length === 0) {
        const res = await apiFetch('/admin/full-results');
        if (res && res.data.success) cachedFullResults = res.data.results;
    }
    if (cachedFullResults.length === 0) {
        showToast('info', 'No Data', 'No results to export yet.');
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Full Results Report', 14, 18);
    doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 26);
    const rows = cachedFullResults.map(r => [r.student_name, r.matric_number, r.course_code, r.course_title, r.ca_score, r.exam_score, r.total_score, r.grade, r.academic_year]);
    doc.autoTable({ head: [['Student', 'Matric', 'Course Code', 'Course Title', 'CA', 'Exam', 'Total', 'Grade', 'Year']], body: rows, startY: 32 });

    const totalRecords = cachedFullResults.length;
    const passed = cachedFullResults.filter(r => (parseFloat(r.total_score) || 0) >= 40).length;
    const passRate = totalRecords > 0 ? ((passed / totalRecords) * 100).toFixed(1) : '0.0';
    const summaryY = doc.lastAutoTable.finalY + 10;
    doc.text(`Total Records: ${totalRecords}`, 14, summaryY);
    doc.text(`Pass Rate: ${passRate}%`, 14, summaryY + 8);

    doc.save(`full_results_report_${Date.now()}.pdf`);
    showToast('success', 'PDF Downloaded', 'Full results report saved.');
}

// ============================================================
// INIT EXTRA SETUP
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    setupAutoGenerators();
    setupEditForms();
});
