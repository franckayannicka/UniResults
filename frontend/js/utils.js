// frontend/js/utils.js
// Shared utilities for all dashboard pages

const API_BASE = 'http://localhost:5000/api';

// ============================================================
// AUTH HELPERS
// ============================================================
function getToken() {
    return localStorage.getItem('token');
}

function getUser() {
    try {
        return JSON.parse(localStorage.getItem('user'));
    } catch (e) { return null; }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

function requireAuth(expectedRole) {
    const token = getToken();
    const user = getUser();
    if (!token || !user) {
        window.location.href = 'login.html';
        return null;
    }
    if (expectedRole && user.role !== expectedRole) {
        alert(`Access denied. This page is for ${expectedRole}s only.`);
        logout();
        return null;
    }
    return user;
}

// ============================================================
// API FETCH WRAPPER
// ============================================================
async function apiFetch(endpoint, options = {}) {
    const token = getToken();
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...options.headers
        },
        ...options
    };

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, config);
        const data = await response.json();

        if (response.status === 401) {
            logout();
            return null;
        }

        return { status: response.status, data };
    } catch (err) {
        console.error('API Error:', err);
        return { status: 0, data: { success: false, message: 'Network error. Is the server running?' } };
    }
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
let toastContainer = null;

function initToasts() {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
}

function showToast(type, title, message, duration = 4000) {
    if (!toastContainer) initToasts();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon"></div>
        <div class="toast-body">
            <div class="toast-title">${title}</div>
            ${message ? `<div class="toast-msg">${message}</div>` : ''}
        </div>
    `;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('exit');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ============================================================
// LOADING OVERLAY
// ============================================================
let loadingOverlay = null;

function showLoading(text = 'Loading...') {
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.innerHTML = `
            <div style="text-align:center">
                <div class="spinner"></div>
                <div class="loading-text" id="loadingText">${text}</div>
            </div>
        `;
        document.body.appendChild(loadingOverlay);
    } else {
        document.getElementById('loadingText').textContent = text;
        loadingOverlay.style.display = 'flex';
    }
}

function hideLoading() {
    if (loadingOverlay) loadingOverlay.style.display = 'none';
}

// ============================================================
// NAVIGATION
// ============================================================
function initNav(defaultPage) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const target = item.dataset.page;
            if (target) navigateTo(target);
        });
    });

    // Mobile hamburger
    const hamburger = document.getElementById('hamburger');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (hamburger && sidebar) {
        hamburger.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            if (overlay) overlay.classList.toggle('show');
        });
    }

    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('show');
        });
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    if (defaultPage) navigateTo(defaultPage);
}

function navigateTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const page = document.getElementById(`page-${pageId}`);
    if (page) page.classList.add('active');

    const navItem = document.querySelector(`.nav-item[data-page="${pageId}"]`);
    if (navItem) navItem.classList.add('active');

    // Close sidebar on mobile
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
}

// ============================================================
// POPULATE USER INFO IN SIDEBAR
// ============================================================
function populateSidebarUser(user) {
    const nameEl = document.getElementById('sidebarUserName');
    const roleEl = document.getElementById('sidebarUserRole');
    const avatarEl = document.getElementById('sidebarAvatar');

    if (nameEl) nameEl.textContent = `${user.firstName} ${user.lastName}`;
    if (roleEl) roleEl.textContent = user.role;
    if (avatarEl) avatarEl.textContent = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
}

// ============================================================
// FORM HELPERS
// ============================================================
function getFormData(formId) {
    const form = document.getElementById(formId);
    if (!form) return {};
    const data = {};
    new FormData(form).forEach((value, key) => { data[key] = value; });
    return data;
}

function resetForm(formId) {
    const form = document.getElementById(formId);
    if (form) form.reset();
}

function setButtonLoading(btnId, loading, originalText = 'Submit') {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = loading ? 'Processing...' : originalText;
}

// ============================================================
// GRADE HELPERS
// ============================================================
function getGradeBadge(grade) {
    const map = { A: 'success', B: 'teal', C: 'warning', D: 'gold', E: 'warning', F: 'danger' };
    const cls = map[grade] || 'muted';
    return `<span class="badge badge-${cls}">${grade || 'N/A'}</span>`;
}

function getStatusBadge(score) {
    if (score === null || score === undefined) return `<span class="badge badge-muted">Pending</span>`;
    return score >= 40
        ? `<span class="badge badge-success">Passed</span>`
        : `<span class="badge badge-danger">Failed</span>`;
}

function getRoleBadge(role) {
    const map = { admin: 'gold', lecturer: 'teal', student: 'success' };
    return `<span class="badge badge-${map[role] || 'muted'}">${role}</span>`;
}

// ============================================================
// INLINE LOADER
// ============================================================
function inlineLoader(containerId) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = `
        <div class="inline-loader">
            <div class="spinner"></div>
            <span>Loading...</span>
        </div>
    `;
}

function emptyState(containerId, icon, title, message) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">${icon}</div>
            <h3>${title}</h3>
            <p>${message}</p>
        </div>
    `;
}

// ============================================================
// POPULATE SELECT DROPDOWNS
// ============================================================
async function populateSelect(selectId, endpoint, valueKey, labelKey, placeholder = 'Select...') {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.innerHTML = `<option value="">-- ${placeholder} --</option>`;
    const res = await apiFetch(endpoint);
    if (!res || !res.data.success) return;

    const items = res.data[Object.keys(res.data).find(k => Array.isArray(res.data[k]))] || [];
    items.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item[valueKey];
        opt.textContent = item[labelKey];
        select.appendChild(opt);
    });
}

// ============================================================
// MODAL HELPERS
// ============================================================
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'flex';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.style.display = 'none';
    }
});

// ============================================================
// PROFILE HELPERS
// ============================================================
// Build full URL for profile picture
function getProfilePictureUrl(picturePath) {
    if (!picturePath) return null;
    if (picturePath.startsWith('http')) return picturePath;
    return `http://localhost:5000${picturePath}`;
}

// Update sidebar avatar with profile picture or initials
function updateSidebarAvatar(profilePicturePath, firstName, lastName) {
    const avatarEl = document.getElementById('sidebarAvatar');
    if (!avatarEl) return;

    if (profilePicturePath) {
        const url = getProfilePictureUrl(profilePicturePath);
        avatarEl.style.backgroundImage = `url('${url}')`;
        avatarEl.style.backgroundSize = 'cover';
        avatarEl.style.backgroundPosition = 'center';
        avatarEl.style.color = 'transparent';
        avatarEl.textContent = '';
    } else {
        avatarEl.style.backgroundImage = 'none';
        avatarEl.style.color = 'white';
        avatarEl.textContent = `${(firstName||'')[0]}${(lastName||'')[0]}`.toUpperCase();
    }
}

// Save updated user info to localStorage after profile update
function refreshLocalUser(updates) {
    const user = getUser();
    if (!user) return;
    const updated = { ...user, ...updates };
    localStorage.setItem('user', JSON.stringify(updated));
}

// ============================================================
// PDF HELPERS
// ============================================================
// Safe jsPDF getter — shows a helpful error if CDN failed to load
function getPDFDoc() {
    if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
        showToast('error', 'PDF Error', 'PDF library not loaded. Check your internet connection and refresh the page.');
        return null;
    }
    const { jsPDF } = window.jspdf;
    return new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
}

// Format date for PDF filenames: YYYY-MM-DD
function getPDFDateStr() {
    return new Date().toISOString().split('T')[0];
}

// Format display date: 01 January 2024
function getPDFDisplayDate() {
    return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}
