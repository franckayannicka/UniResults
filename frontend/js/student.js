// frontend/js/student.js

let cachedResults = [];
let cachedGpa = null;

document.addEventListener('DOMContentLoaded', async () => {
    const user = requireAuth('student');
    if (!user) return;

    populateSidebarUser(user);

    // Update welcome message
    document.getElementById('studentWelcome').textContent = `Welcome, ${user.firstName} 👋`;
    document.getElementById('studentSubtitle').textContent =
        `${user.matric_number ? user.matric_number + ' · ' : ''}${user.department_name || ''}`;

    if (user.matric_number) {
        document.getElementById('topbarMatric').textContent = user.matric_number;
    }

    initNav('dashboard');

    // Update topbar titles on nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const titles = {
                dashboard: 'Dashboard', courses: 'My Courses',
                results: 'My Results', gpa: 'GPA Summary', profile: 'My Profile'
            };
            const t = item.dataset.page;
            if (titles[t]) document.getElementById('topbarTitle').textContent = titles[t];
        });
    });

    // Lazy-load on nav click
    document.querySelector('[data-page="courses"]').addEventListener('click', loadStudentCourses);
    document.querySelector('[data-page="results"]').addEventListener('click', loadStudentResults);
    document.querySelector('[data-page="gpa"]').addEventListener('click', loadGpaSummaryPage);
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

    // Load profile picture from server on page init
    apiFetch('/profile/me').then(res => {
        if (res && res.data.success && res.data.profile.profile_picture) {
            updateSidebarAvatar(res.data.profile.profile_picture, user.firstName, user.lastName);
            updateTopbarAvatar(res.data.profile.profile_picture, user.firstName, user.lastName);
        }
    });

    // Load dashboard data
    await loadDashboardData();
});

// ============================================================
// DASHBOARD DATA
// ============================================================
async function loadDashboardData() {
    const [coursesRes, resultsRes, gpaRes] = await Promise.all([
        apiFetch('/student/my-courses'),
        apiFetch('/student/my-results'),
        apiFetch('/student/gpa-summary')
    ]);

    // Courses count
    if (coursesRes && coursesRes.data.success) {
        document.getElementById('statEnrolled').textContent = coursesRes.data.courses.length;
    }

    // Results count
    if (resultsRes && resultsRes.data.success) {
        const withMarks = resultsRes.data.results.filter(r => r.total_score !== null).length;
        document.getElementById('statResultsOut').textContent = withMarks;
    }

    // GPA data
    if (gpaRes && gpaRes.data.success) {
        const g = gpaRes.data;
        cachedGpa = g;
        document.getElementById('statGPA').textContent = g.gpa > 0 ? g.gpa.toFixed(2) : '—';

        const classAbbrev = {
            'First Class Honours': '1st Class',
            'Second Class Upper': '2:1',
            'Second Class Lower': '2:2',
            'Third Class': '3rd',
            'Pass': 'Pass',
            'Fail': 'Fail'
        };
        document.getElementById('statClass').textContent = classAbbrev[g.classification] || '—';

        // GPA ring (dashboard)
        if (g.gpa > 0) {
            const pct = g.gpa / 5.0;
            const circumference = 314;
            const offset = circumference - (pct * circumference);
            const ring = document.getElementById('gpaRingProgress');
            if (ring) {
                setTimeout(() => { ring.style.strokeDashoffset = offset; }, 300);
            }
            document.getElementById('gpaRingValue').textContent = g.gpa.toFixed(2);
            document.getElementById('gpaClassText').textContent = g.classification;
            document.getElementById('gpaMeta').innerHTML =
                `Completed: ${g.courses_completed} course${g.courses_completed !== 1 ? 's' : ''}<br>
                 Credit Units: ${g.total_credit_units}<br>
                 Grade Points: ${g.grade_points}`;
        }

        // Grade distribution bars
        if (g.grade_distribution) {
            const dist = g.grade_distribution;
            const maxVal = Math.max(...Object.values(dist), 1);
            const maxHeight = 48;
            ['A','B','C','D','E','F'].forEach(grade => {
                const count = dist[grade] || 0;
                const height = Math.max((count / maxVal) * maxHeight, 4);
                const bar = document.getElementById(`bar${grade}`);
                const cnt = document.getElementById(`cnt${grade}`);
                if (bar) setTimeout(() => { bar.style.height = height + 'px'; }, 300);
                if (cnt) cnt.textContent = count;
            });
        }
    }
}

// ============================================================
// MY COURSES
// ============================================================
async function loadStudentCourses() {
    const grid = document.getElementById('studentCoursesGrid');
    grid.innerHTML = `<div class="inline-loader"><div class="spinner"></div><span>Loading...</span></div>`;

    const res = await apiFetch('/student/my-courses');
    if (!res || !res.data.success) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">❌</div><h3>Error</h3><p>Could not load courses.</p></div>`;
        return;
    }

    const courses = res.data.courses;
    if (courses.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;">
                <div class="empty-icon">📚</div>
                <h3>No Courses Yet</h3>
                <p>You have not been enrolled in any courses. Contact your admin.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = courses.map(c => `
        <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
                <span class="badge badge-gold">${c.course_code}</span>
                <span class="badge badge-muted">${c.semester}</span>
            </div>
            <h3 style="font-size:15px;margin-bottom:6px;font-family:'DM Sans',sans-serif;color:var(--text-primary);">${c.course_title}</h3>
            <p style="font-size:12px;color:var(--text-muted);margin-bottom:14px;">${c.department_name}</p>
            <div class="divider" style="margin:12px 0;"></div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <span style="font-size:11px;color:var(--text-muted);">Credits</span>
                    <div style="font-weight:700;color:var(--teal);">${c.credit_units}</div>
                </div>
                <div>
                    <span style="font-size:11px;color:var(--text-muted);">Level</span>
                    <div style="font-weight:700;color:var(--gold);">${c.level}L</div>
                </div>
                <div>
                    <span style="font-size:11px;color:var(--text-muted);">Lecturer</span>
                    <div style="font-size:12px;color:var(--text-secondary);">${c.lecturer_title || ''} ${c.lecturer_name || 'TBA'}</div>
                </div>
            </div>
        </div>
    `).join('');
}

// ============================================================
// MY RESULTS
// ============================================================
async function loadStudentResults() {
    const tbody = document.getElementById('resultsTableBody');
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;"><div class="inline-loader"><div class="spinner"></div><span>Loading...</span></div></td></tr>`;

    const res = await apiFetch('/student/my-results');
    if (!res || !res.data.success) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--danger);padding:32px;">Could not load results.</td></tr>`;
        return;
    }

    const results = res.data.results;
    cachedResults = results;
    if (results.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:32px;">No results available yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = results.map(r => `
        <tr>
            <td><span class="badge badge-gold">${r.course_code}</span></td>
            <td style="color:var(--text-primary);font-weight:500;">${r.course_title}</td>
            <td style="text-align:center;">${r.credit_units}</td>
            <td style="text-align:center;">${r.ca_score !== null ? parseFloat(r.ca_score).toFixed(1) : '<span class="badge badge-muted">—</span>'}</td>
            <td style="text-align:center;">${r.exam_score !== null ? parseFloat(r.exam_score).toFixed(1) : '<span class="badge badge-muted">—</span>'}</td>
            <td style="text-align:center;font-weight:700;color:${r.total_score >= 40 ? 'var(--success)' : r.total_score !== null ? 'var(--danger)' : 'var(--text-muted)'};">
                ${r.total_score !== null ? parseFloat(r.total_score).toFixed(1) : '—'}
            </td>
            <td style="text-align:center;">${r.grade ? getGradeBadge(r.grade) : '<span class="badge badge-muted">—</span>'}</td>
            <td>${r.total_score !== null ? getStatusBadge(r.total_score) : '<span class="badge badge-muted">Pending</span>'}</td>
        </tr>
    `).join('');
}

// ============================================================
// GPA SUMMARY PAGE
// ============================================================
async function loadGpaSummaryPage() {
    const res = await apiFetch('/student/gpa-summary');
    if (!res || !res.data.success) {
        showToast('error', 'Error', 'Could not load GPA data.');
        return;
    }

    const g = res.data;

    // Update large ring
    const ring = document.getElementById('gpaPageRing');
    if (ring && g.gpa > 0) {
        const pct = g.gpa / 5.0;
        const circumference = 408;
        const offset = circumference - (pct * circumference);
        setTimeout(() => { ring.style.strokeDashoffset = offset; }, 200);
    }

    document.getElementById('gpaPageValue').textContent = g.gpa > 0 ? g.gpa.toFixed(2) : '0.00';
    document.getElementById('gpaPageClass').textContent = g.classification || '—';
    document.getElementById('gpaPageUnits').textContent =
        `${g.courses_completed} course${g.courses_completed !== 1 ? 's' : ''} · ${g.total_credit_units} total units · ${g.grade_points} grade points`;

    // Breakdown
    const breakdown = document.getElementById('gpaBreakdown');
    if (g.courses_completed === 0) {
        breakdown.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:20px;">No results yet.</div>`;
        return;
    }

    const gradeInfo = {
        A: { color: 'var(--success)', label: 'Excellent', gp: '5.0' },
        B: { color: 'var(--teal)', label: 'Good', gp: '4.0' },
        C: { color: 'var(--warning)', label: 'Average', gp: '3.0' },
        D: { color: 'var(--gold)', label: 'Below Average', gp: '2.0' },
        E: { color: '#ff9f43', label: 'Pass', gp: '1.0' },
        F: { color: 'var(--danger)', label: 'Fail', gp: '0.0' }
    };

    const dist = g.grade_distribution;
    const total = g.courses_completed;

    breakdown.innerHTML = Object.entries(gradeInfo).map(([grade, info]) => {
        const count = dist[grade] || 0;
        const pct = total > 0 ? (count / total) * 100 : 0;
        return `
            <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span class="badge" style="background:rgba(255,255,255,0.07);color:${info.color};min-width:32px;justify-content:center;">${grade}</span>
                        <span style="font-size:12px;color:var(--text-secondary);">${info.label} · GP ${info.gp}</span>
                    </div>
                    <span style="font-size:13px;font-weight:600;color:${info.color};">${count}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:0%;background:${info.color};transition:width 0.8s ease;"
                         data-width="${pct.toFixed(0)}"></div>
                </div>
            </div>
        `;
    }).join('');

    // Animate progress bars
    setTimeout(() => {
        document.querySelectorAll('#gpaBreakdown .progress-fill').forEach(bar => {
            bar.style.width = bar.dataset.width + '%';
        });
    }, 100);
}

// ============================================================
// DOWNLOAD RESULTS PDF
// ============================================================
async function downloadResultsPDF() {
    // Guard: check jsPDF is loaded
    const doc = getPDFDoc();
    if (!doc) return;

    // Guard: load results if not cached
    if (!cachedResults || cachedResults.length === 0) {
        showToast('info', 'Loading Results', 'Fetching your results, please wait...');
        await loadStudentResults();
        if (!cachedResults || cachedResults.length === 0) {
            showToast('error', 'No Results', 'No results available to download.');
            return;
        }
    }

    // Guard: load GPA if not cached
    if (!cachedGpa) {
        const gpaRes = await apiFetch('/student/gpa-summary');
        if (gpaRes && gpaRes.data.success) {
            cachedGpa = gpaRes.data;
        }
    }

    const user = getUser() || {};
    const gpa = cachedGpa || { gpa: 0, classification: 'Pending', total_credit_units: 0, courses_completed: 0 };
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 18;

    // ---- HEADER ----
    doc.setFillColor(13, 27, 62);
    doc.rect(0, 0, pageW, 38, 'F');

    doc.setFillColor(201, 162, 39);
    doc.rect(0, 38, pageW, 2.5, 'F');

    doc.setTextColor(201, 162, 39);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text('UNIVERSITY RESULTS MANAGEMENT SYSTEM', pageW / 2, 14, { align: 'center' });

    doc.setTextColor(168, 180, 204);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Official Academic Transcript', pageW / 2, 23, { align: 'center' });

    doc.setTextColor(108, 117, 125);
    doc.setFontSize(8);
    doc.text('Generated: ' + getPDFDisplayDate(), pageW / 2, 32, { align: 'center' });

    // ---- STUDENT INFO BOX ----
    let y = 50;
    doc.setFillColor(22, 32, 64);
    doc.roundedRect(margin, y, pageW - margin * 2, 30, 3, 3, 'F');

    doc.setTextColor(201, 162, 39);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('STUDENT INFORMATION', margin + 5, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 210, 240);
    doc.setFontSize(8.5);

    const col1x = margin + 5;
    const col2x = margin + (pageW - margin * 2) / 2 + 5;

    doc.text('Name: ' + (user.firstName || '') + ' ' + (user.lastName || ''), col1x, y + 16);
    doc.text('Email: ' + (user.email || '—'), col1x, y + 23);
    doc.text('Matric No: ' + (user.matric_number || '—'), col2x, y + 16);
    doc.text('Department: ' + (user.department_name || '—'), col2x, y + 23);

    // ---- RESULTS TABLE ----
    y += 38;

    const gradeColors = {
        A: [6, 214, 160],
        B: [0, 180, 216],
        C: [255, 209, 102],
        D: [201, 162, 39],
        E: [255, 159, 67],
        F: [239, 71, 111]
    };

    const tableRows = cachedResults.map(r => [
        r.course_code || '—',
        r.course_title || '—',
        String(r.credit_units || '—'),
        r.ca_score !== null && r.ca_score !== undefined ? parseFloat(r.ca_score).toFixed(1) : '—',
        r.exam_score !== null && r.exam_score !== undefined ? parseFloat(r.exam_score).toFixed(1) : '—',
        r.total_score !== null && r.total_score !== undefined ? parseFloat(r.total_score).toFixed(1) : '—',
        r.grade || '—',
        r.total_score !== null && r.total_score !== undefined
            ? (parseFloat(r.total_score) >= 40 ? 'Pass' : 'Fail')
            : 'Pending'
    ]);

    doc.autoTable({
        startY: y,
        head: [['Code', 'Course Title', 'Units', 'CA /40', 'Exam /60', 'Total', 'Grade', 'Status']],
        body: tableRows,
        theme: 'grid',
        margin: { left: margin, right: margin },
        headStyles: {
            fillColor: [13, 27, 62],
            textColor: [201, 162, 39],
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
            0: { fontStyle: 'bold', cellWidth: 22 },
            1: { halign: 'left', cellWidth: 55 },
            2: { cellWidth: 12 },
            3: { cellWidth: 14 },
            4: { cellWidth: 15 },
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

    // ---- GPA SUMMARY BOX ----
    let fy = doc.lastAutoTable.finalY + 8;

    // Check if there's room, else add page
    if (fy + 32 > pageH - 20) {
        doc.addPage();
        fy = 20;
    }

    doc.setFillColor(13, 27, 62);
    doc.roundedRect(margin, fy, pageW - margin * 2, 30, 3, 3, 'F');

    doc.setFillColor(201, 162, 39);
    doc.roundedRect(margin, fy, 3, 30, 1, 1, 'F');

    doc.setTextColor(201, 162, 39);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('GPA SUMMARY', margin + 8, fy + 9);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 210, 240);
    doc.setFontSize(8.5);
    doc.text('Cumulative GPA: ' + (gpa.gpa > 0 ? parseFloat(gpa.gpa).toFixed(2) : '—') + ' / 5.0', margin + 8, fy + 18);
    doc.text('Classification: ' + (gpa.classification || '—'), margin + 8, fy + 25);

    doc.text('Total Credit Units: ' + (gpa.total_credit_units || 0), col2x, fy + 18);
    doc.text('Courses Completed: ' + (gpa.courses_completed || 0), col2x, fy + 25);

    // ---- FOOTER ----
    const footerY = pageH - 10;
    doc.setFillColor(201, 162, 39);
    doc.rect(0, footerY - 5, pageW, 0.5, 'F');
    doc.setTextColor(150, 160, 180);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.text(
        'This is an official computer-generated transcript. University Results Management System.',
        pageW / 2,
        footerY,
        { align: 'center' }
    );

    // ---- SAVE ----
    const matricStr = (user.matric_number || 'student').replace(/\//g, '-');
    doc.save('transcript_' + matricStr + '_' + getPDFDateStr() + '.pdf');
    showToast('success', 'PDF Downloaded', 'Your transcript has been saved.');
}

