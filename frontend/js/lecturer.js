// frontend/js/lecturer.js

let allCourses = [];
let selectedCourseId = null;
let isEditMode = false;
let cachedCourseStudents = [];

document.addEventListener('DOMContentLoaded', async () => {
    const user = requireAuth('lecturer');
    if (!user) return;

    populateSidebarUser(user);
    document.getElementById('lecturerWelcome').textContent =
        `Welcome, ${user.title || ''} ${user.firstName} 👋`.trim();

    // Load profile picture on init
    apiFetch('/profile/me').then(res => {
        if (res && res.data.success && res.data.profile.profile_picture) {
            updateSidebarAvatar(res.data.profile.profile_picture, user.firstName, user.lastName);
            updateTopbarAvatar(res.data.profile.profile_picture, user.firstName, user.lastName);
        }
    });

    initNav('dashboard');

    // Update topbar title on nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const titles = { dashboard: 'Dashboard', courses: 'My Courses', marks: 'Upload Marks', profile: 'My Profile' };
            const t = item.dataset.page;
            if (titles[t]) document.getElementById('topbarTitle').textContent = titles[t];
        });
    });

    document.querySelector('[data-page="courses"]').addEventListener('click', renderCourseCards);
    document.querySelector('[data-page="marks"]').addEventListener('click', populateMarksCourseSelect);
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

    await loadLecturerCourses();
    setupMarkForm();
    setupLiveTotalCalc();
});

// ============================================================
// LOAD LECTURER COURSES
// ============================================================
async function loadLecturerCourses() {
    const res = await apiFetch('/lecturer/my-courses');
    if (!res || !res.data.success) {
        showToast('error', 'Error', 'Could not load your courses.');
        return;
    }

    allCourses = res.data.courses;

    // Update stats
    document.getElementById('statMyCourses').textContent = allCourses.length;
    const totalStudents = allCourses.reduce((sum, c) => sum + (parseInt(c.enrolled_count) || 0), 0);
    document.getElementById('statTotalStudents').textContent = totalStudents;

    // Render dashboard table
    renderDashCourseTable();
}

function renderDashCourseTable() {
    const tbody = document.getElementById('dashCoursesBody');
    if (allCourses.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px;">No courses assigned yet. Contact admin.</td></tr>`;
        return;
    }
    tbody.innerHTML = allCourses.map(c => `
        <tr>
            <td><span class="badge badge-gold">${c.course_code}</span></td>
            <td style="color:var(--text-primary);font-weight:500;">${c.course_title}</td>
            <td><span class="badge badge-teal">${c.level}L</span></td>
            <td><span class="badge badge-muted">${c.semester}</span></td>
            <td style="text-align:center;font-weight:600;color:var(--gold);">${c.enrolled_count || 0}</td>
            <td>
                <button class="btn btn-teal btn-sm" onclick="goToMarks(${c.id})">📝 Marks</button>
            </td>
        </tr>
    `).join('');
}

// ============================================================
// COURSE CARDS
// ============================================================
function renderCourseCards() {
    const grid = document.getElementById('coursesGrid');
    if (allCourses.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;">
                <div class="empty-icon">📚</div>
                <h3>No Courses Yet</h3>
                <p>No courses have been assigned to you. Contact your admin.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = allCourses.map(c => `
        <div class="card" style="cursor:pointer;" onclick="goToMarks(${c.id})">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
                <span class="badge badge-gold">${c.course_code}</span>
                <span class="badge badge-teal">${c.semester}</span>
            </div>
            <h3 style="font-size:16px;margin-bottom:6px;font-family:'DM Sans',sans-serif;color:var(--text-primary);">${c.course_title}</h3>
            <p style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">${c.department_name} · ${c.level} Level</p>
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <div style="font-size:22px;font-weight:700;font-family:'Playfair Display',serif;color:var(--gold);">${c.enrolled_count || 0}</div>
                    <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.8px;">Students</div>
                </div>
                <div>
                    <div style="font-size:22px;font-weight:700;font-family:'Playfair Display',serif;color:var(--teal);">${c.credit_units}</div>
                    <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.8px;">Credits</div>
                </div>
                <button class="btn btn-teal btn-sm">Upload Marks →</button>
            </div>
        </div>
    `).join('');
}

// ============================================================
// GO TO MARKS (from dashboard or course card)
// ============================================================
function goToMarks(courseId) {
    navigateTo('marks');
    document.getElementById('topbarTitle').textContent = 'Upload Marks';

    // Pre-select the course
    populateMarksCourseSelect().then(() => {
        const select = document.getElementById('marksCourseSelect');
        select.value = courseId;
        loadCourseStudents();
    });
}

// ============================================================
// MARKS COURSE SELECT
// ============================================================
async function populateMarksCourseSelect() {
    if (allCourses.length === 0) {
        await loadLecturerCourses();
    }
    const select = document.getElementById('marksCourseSelect');
    const current = select.value;
    select.innerHTML = '<option value="">-- Select a course --</option>';
    allCourses.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.course_code} — ${c.course_title}`;
        select.appendChild(opt);
    });
    if (current) select.value = current;
}

// ============================================================
// LOAD COURSE STUDENTS WITH MARKS
// ============================================================
async function loadCourseStudents() {
    selectedCourseId = document.getElementById('marksCourseSelect').value;
    if (!selectedCourseId) {
        showToast('info', 'Select a Course', 'Please choose a course first.');
        return;
    }

    const tbody = document.getElementById('marksTableBody');
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;"><div class="inline-loader"><div class="spinner"></div><span>Loading...</span></div></td></tr>`;
    document.getElementById('marksSection').style.display = 'block';

    const res = await apiFetch(`/lecturer/course-students/${selectedCourseId}`);
    if (!res || !res.data.success) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--danger);padding:32px;">${res?.data?.message || 'Failed to load students.'}</td></tr>`;
        return;
    }

    const students = res.data.students;
    cachedCourseStudents = students;
    const course = allCourses.find(c => c.id == selectedCourseId);

    document.getElementById('marksCourseTitle').textContent = course ? `${course.course_code} — ${course.course_title}` : 'Course Students';
    document.getElementById('marksStudentCount').textContent = `${students.length} student${students.length !== 1 ? 's' : ''}`;

    // Update marks uploaded count
    const uploaded = students.filter(s => s.mark_id !== null).length;
    document.getElementById('statMarksUploaded').textContent = uploaded;

    if (students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:32px;">No students enrolled in this course yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = students.map(s => {
        const hasMarks = s.mark_id !== null;
        const actionCellId = hasMarks ? `mark-action-${s.mark_id}-${s.student_id}` : `mark-action-new-${s.student_id}`;
        return `
        <tr>
            <td><code style="color:var(--gold);font-size:11px;">${s.matric_number}</code></td>
            <td style="color:var(--text-primary);font-weight:500;">${s.last_name}, ${s.first_name}</td>
            <td style="text-align:center;">${hasMarks ? `<span style="color:var(--teal);">${parseFloat(s.ca_score).toFixed(1)}</span>` : '<span class="badge badge-muted">—</span>'}</td>
            <td style="text-align:center;">${hasMarks ? `<span style="color:var(--teal);">${parseFloat(s.exam_score).toFixed(1)}</span>` : '<span class="badge badge-muted">—</span>'}</td>
            <td style="text-align:center;font-weight:700;color:var(--text-primary);">${hasMarks ? parseFloat(s.total_score).toFixed(1) : '—'}</td>
            <td style="text-align:center;">${hasMarks ? getGradeBadge(s.grade) : '<span class="badge badge-muted">—</span>'}</td>
            <td>${hasMarks ? getStatusBadge(s.total_score) : '<span class="badge badge-muted">Pending</span>'}</td>
            <td id="${actionCellId}">
                <button class="btn btn-sm ${hasMarks ? 'btn-outline' : 'btn-primary'}"
                    onclick="openMarkModal(${s.student_id}, '${s.first_name} ${s.last_name}', '${s.matric_number}',
                        ${hasMarks}, ${s.mark_id || 'null'}, ${s.ca_score || 0}, ${s.exam_score || 0}, '${s.remarks || ''}')">
                    ${hasMarks ? '✏️ Edit' : '➕ Add'}
                </button>
                ${hasMarks ? `<button class="btn btn-danger btn-sm" style="margin-left:8px;" onclick="promptDeleteMark(${s.mark_id}, ${s.student_id})">🗑️ Delete</button>` : ''}
            </td>
        </tr>
        `;
    }).join('');
}

// ============================================================
// MARK MODAL
// ============================================================
function openMarkModal(studentId, studentName, matricNo, isEdit, markId, caScore, examScore, remarks) {
    isEditMode = isEdit;

    document.getElementById('markModalTitle').textContent = isEdit ? 'Update Marks' : 'Upload Marks';
    document.getElementById('markModalStudentInfo').innerHTML = `
        <strong style="color:var(--text-primary);">${studentName}</strong>
        <span style="color:var(--text-muted);margin-left:12px;">Matric: ${matricNo}</span>
    `;

    document.getElementById('markStudentId').value = studentId;
    document.getElementById('markCourseId').value = selectedCourseId;
    document.getElementById('markId').value = markId || '';
    document.getElementById('caScore').value = isEdit ? caScore : '';
    document.getElementById('examScore').value = isEdit ? examScore : '';
    document.getElementById('markRemarks').value = isEdit ? remarks : '';
    document.getElementById('markSubmitBtn').textContent = isEdit ? 'Update Marks' : 'Save Marks';

    updateLiveTotal();
    openModal('markModal');
}

function setupLiveTotalCalc() {
    document.getElementById('caScore').addEventListener('input', updateLiveTotal);
    document.getElementById('examScore').addEventListener('input', updateLiveTotal);
}

function updateLiveTotal() {
    const ca = parseFloat(document.getElementById('caScore').value) || 0;
    const exam = parseFloat(document.getElementById('examScore').value) || 0;
    const total = ca + exam;
    const el = document.getElementById('liveTotal');
    el.textContent = total.toFixed(1);
    el.style.color = total >= 40 ? 'var(--success)' : total >= 30 ? 'var(--warning)' : 'var(--danger)';
}

// ============================================================
// MARK FORM SUBMIT
// ============================================================
function setupMarkForm() {
    document.getElementById('markForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = Object.fromEntries(new FormData(e.target));

        const btn = document.getElementById('markSubmitBtn');
        btn.disabled = true;
        btn.textContent = 'Saving...';

        let res;
        if (isEditMode) {
            res = await apiFetch('/lecturer/update-marks', {
                method: 'PUT',
                body: JSON.stringify({
                    mark_id: formData.mark_id,
                    ca_score: parseFloat(formData.ca_score),
                    exam_score: parseFloat(formData.exam_score),
                    remarks: formData.remarks
                })
            });
        } else {
            res = await apiFetch('/lecturer/upload-marks', {
                method: 'POST',
                body: JSON.stringify({
                    student_id: formData.student_id,
                    course_id: formData.course_id,
                    ca_score: parseFloat(formData.ca_score),
                    exam_score: parseFloat(formData.exam_score),
                    academic_year: formData.academic_year,
                    remarks: formData.remarks
                })
            });
        }

        btn.disabled = false;
        btn.textContent = isEditMode ? 'Update Marks' : 'Save Marks';

        if (!res) return;
        if (res.data.success) {
            showToast('success', isEditMode ? 'Marks Updated' : 'Marks Saved', res.data.message);
            closeModal('markModal');
            loadCourseStudents();
        } else {
            showToast('error', 'Error', res.data.message);
        }
    });
}

// ============================================================
// DELETE MARKS
// ============================================================
function promptDeleteMark(markId, studentId) {
    const cellId = `mark-action-${markId}-${studentId}`;
    const cell = document.getElementById(cellId);
    if (!cell) return;

    cell.dataset.original = cell.innerHTML;
    cell.innerHTML = `
        <div class="inline-confirm" style="display:flex;align-items:center;gap:8px;">
            <span style="color:var(--text-muted);font-size:12px;">Delete marks?</span>
            <button class="btn btn-danger btn-sm" onclick="confirmDeleteMark(${markId}, ${studentId})">Yes</button>
            <button class="btn btn-outline btn-sm" onclick="cancelInlineAction('${cellId}')">No</button>
        </div>
    `;
}

function cancelInlineAction(cellId) {
    const cell = document.getElementById(cellId);
    if (cell && cell.dataset.original) {
        cell.innerHTML = cell.dataset.original;
        delete cell.dataset.original;
    } else {
        loadCourseStudents();
    }
}

async function confirmDeleteMark(markId, studentId) {
    const cellId = `mark-action-${markId}-${studentId}`;
    const cell = document.getElementById(cellId);
    if (cell) {
        cell.innerHTML = '<span class="badge badge-danger">Deleting...</span>';
    }

    const res = await apiFetch('/lecturer/delete-marks', {
        method: 'DELETE',
        body: JSON.stringify({ mark_id: markId })
    });

    if (res && res.data.success) {
        showToast('success', 'Marks Deleted', res.data.message);
        loadCourseStudents();
    } else {
        showToast('error', 'Error', res?.data?.message || 'Failed to delete marks.');
        loadCourseStudents();
    }
}

// ============================================================
// DOWNLOAD MARK SHEET PDF
// ============================================================
async function downloadMarkSheetPDF() {
    // Guard: check jsPDF loaded
    const doc = getPDFDoc();
    if (!doc) return;

    // Guard: must have a course selected
    if (!selectedCourseId) {
        showToast('info', 'No Course Selected', 'Please select and load a course first.');
        return;
    }

    // Guard: load students if not cached
    if (!cachedCourseStudents || cachedCourseStudents.length === 0) {
        showToast('info', 'Loading Students', 'Fetching student data, please wait...');
        await loadCourseStudents();
        if (!cachedCourseStudents || cachedCourseStudents.length === 0) {
            showToast('error', 'No Data', 'No students found in this course.');
            return;
        }
    }

    const user = getUser() || {};
    const course = allCourses.find(c => String(c.id) === String(selectedCourseId)) || {};
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 18;

    // ---- HEADER ----
    doc.setFillColor(13, 27, 62);
    doc.rect(0, 0, pageW, 38, 'F');

    doc.setFillColor(0, 180, 216);
    doc.rect(0, 38, pageW, 2.5, 'F');

    doc.setTextColor(0, 180, 216);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text('UNIVERSITY RESULTS MANAGEMENT SYSTEM', pageW / 2, 14, { align: 'center' });

    doc.setTextColor(168, 180, 204);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Official Course Mark Sheet', pageW / 2, 23, { align: 'center' });

    doc.setTextColor(108, 117, 125);
    doc.setFontSize(8);
    doc.text('Generated: ' + getPDFDisplayDate(), pageW / 2, 32, { align: 'center' });

    // ---- COURSE INFO BOX ----
    let y = 50;
    doc.setFillColor(22, 32, 64);
    doc.roundedRect(margin, y, pageW - margin * 2, 30, 3, 3, 'F');

    doc.setTextColor(0, 180, 216);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('COURSE INFORMATION', margin + 5, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 210, 240);
    doc.setFontSize(8.5);

    const col1x = margin + 5;
    const col2x = margin + (pageW - margin * 2) / 2 + 5;

    const lecturerName = (user.title ? user.title + ' ' : '') + (user.firstName || '') + ' ' + (user.lastName || '');
    doc.text('Course Code: ' + (course.course_code || '—'), col1x, y + 16);
    doc.text('Lecturer: ' + lecturerName.trim(), col1x, y + 23);
    doc.text('Course Title: ' + (course.course_title || '—'), col2x, y + 16);
    doc.text('Academic Year: ' + (course.academic_year || '2024/2025'), col2x, y + 23);

    // ---- MARKS TABLE ----
    y += 38;

    const gradeColors = {
        A: [6, 214, 160],
        B: [0, 180, 216],
        C: [255, 209, 102],
        D: [201, 162, 39],
        E: [255, 159, 67],
        F: [239, 71, 111]
    };

    const tableRows = cachedCourseStudents.map((s, i) => [
        String(i + 1),
        s.matric_number || '—',
        (s.last_name || '') + ', ' + (s.first_name || ''),
        s.ca_score !== null && s.ca_score !== undefined ? parseFloat(s.ca_score).toFixed(1) : '—',
        s.exam_score !== null && s.exam_score !== undefined ? parseFloat(s.exam_score).toFixed(1) : '—',
        s.total_score !== null && s.total_score !== undefined ? parseFloat(s.total_score).toFixed(1) : '—',
        s.grade || '—',
        s.total_score !== null && s.total_score !== undefined
            ? (parseFloat(s.total_score) >= 40 ? 'Pass' : 'Fail')
            : 'Pending'
    ]);

    doc.autoTable({
        startY: y,
        head: [['#', 'Matric No.', 'Student Name', 'CA /40', 'Exam /60', 'Total', 'Grade', 'Status']],
        body: tableRows,
        theme: 'grid',
        margin: { left: margin, right: margin },
        headStyles: {
            fillColor: [13, 27, 62],
            textColor: [0, 180, 216],
            fontStyle: 'bold',
            fontSize: 8,
            halign: 'center',
            cellPadding: 4
        },
        bodyStyles: {
            fontSize: 8,
            textColor: [40, 55, 90],
            halign: 'center',
            cellPadding: 3
        },
        columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 28, fontStyle: 'bold' },
            2: { halign: 'left', cellWidth: 52 },
            3: { cellWidth: 16 },
            4: { cellWidth: 16 },
            5: { cellWidth: 14, fontStyle: 'bold' },
            6: { cellWidth: 13, fontStyle: 'bold' },
            7: { cellWidth: 18 }
        },
        alternateRowStyles: { fillColor: [240, 244, 255] },
        didParseCell: function(data) {
            if (data.section === 'body') {
                if (data.column.index === 6) {
                    const color = gradeColors[data.cell.raw];
                    if (color) {
                        data.cell.styles.textColor = color;
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
                if (data.column.index === 7) {
                    if (data.cell.raw === 'Pass') data.cell.styles.textColor = [6, 214, 160];
                    else if (data.cell.raw === 'Fail') data.cell.styles.textColor = [239, 71, 111];
                    else data.cell.styles.textColor = [108, 117, 125];
                }
            }
        }
    });

    // ---- SUMMARY BOX ----
    let fy = doc.lastAutoTable.finalY + 8;

    if (fy + 36 > pageH - 20) {
        doc.addPage();
        fy = 20;
    }

    // Compute stats
    const withMarks = cachedCourseStudents.filter(s => s.total_score !== null && s.total_score !== undefined);
    const passed = withMarks.filter(s => parseFloat(s.total_score) >= 40).length;
    const failed = withMarks.filter(s => parseFloat(s.total_score) < 40).length;
    const scores = withMarks.map(s => parseFloat(s.total_score));
    const highest = scores.length > 0 ? Math.max(...scores).toFixed(1) : '—';
    const lowest = scores.length > 0 ? Math.min(...scores).toFixed(1) : '—';
    const average = scores.length > 0
        ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
        : '—';
    const passRate = withMarks.length > 0
        ? ((passed / withMarks.length) * 100).toFixed(0) + '%'
        : '—';

    doc.setFillColor(13, 27, 62);
    doc.roundedRect(margin, fy, pageW - margin * 2, 36, 3, 3, 'F');

    doc.setFillColor(0, 180, 216);
    doc.roundedRect(margin, fy, 3, 36, 1, 1, 'F');

    doc.setTextColor(0, 180, 216);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('CLASS SUMMARY', margin + 8, fy + 9);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 210, 240);
    doc.setFontSize(8.5);

    doc.text('Total Students: ' + cachedCourseStudents.length, margin + 8, fy + 18);
    doc.text('Passed: ' + passed, margin + 8, fy + 25);
    doc.text('Failed: ' + failed, margin + 8, fy + 32);

    doc.text('Highest Score: ' + highest, col2x, fy + 18);
    doc.text('Lowest Score: ' + lowest, col2x, fy + 25);
    doc.text('Class Average: ' + average + '  |  Pass Rate: ' + passRate, col2x, fy + 32);

    // ---- FOOTER ----
    const footerY = pageH - 10;
    doc.setFillColor(0, 180, 216);
    doc.rect(0, footerY - 5, pageW, 0.5, 'F');
    doc.setTextColor(150, 160, 180);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.text(
        'This is an official computer-generated mark sheet. University Results Management System.',
        pageW / 2,
        footerY,
        { align: 'center' }
    );

    // ---- SAVE ----
    const courseCode = (course.course_code || 'course').replace(/\//g, '-');
    doc.save('marksheet_' + courseCode + '_' + getPDFDateStr() + '.pdf');
    showToast('success', 'PDF Downloaded', 'Mark sheet saved successfully.');
}
