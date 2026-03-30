// frontend/js/profile.js
// Shared profile logic used by all three dashboards

let profileData = null;
let selectedPictureFile = null;

// ============================================================
// LOAD PROFILE
// ============================================================
async function loadProfilePage() {
    const res = await apiFetch('/profile/me');
    if (!res || !res.data.success) {
        showToast('error', 'Error', 'Could not load profile data.');
        return;
    }

    profileData = res.data.profile;
    renderProfileHero(profileData);
    populateProfileForm(profileData);
    renderCurrentPicture(profileData.profile_picture);
    setupPictureUpload();
    setupPasswordForm();
    setupProfileInfoForm();
    setupPasswordStrength();
    setupPasswordMatch();
}

// ============================================================
// RENDER HERO SECTION
// ============================================================
function renderProfileHero(p) {
    document.getElementById('heroName').textContent = `${p.first_name} ${p.last_name}`;

    const roleLabels = { admin: '🛡️ System Administrator', lecturer: '👨‍🏫 Lecturer', student: '🎓 Student' };
    document.getElementById('heroRole').textContent = roleLabels[p.role] || p.role;

    let meta = p.email;
    if (p.department_name) meta += ` · ${p.department_name}`;
    if (p.bio) meta += `\n${p.bio}`;
    document.getElementById('heroMeta').textContent = meta;

    // Badge
    const badgeEl = document.getElementById('heroBadge');
    if (p.matric_number) badgeEl.innerHTML = `🎓 ${p.matric_number}`;
    else if (p.staff_id) badgeEl.innerHTML = `🪪 ${p.staff_id}`;
    else badgeEl.innerHTML = `⚙️ Admin`;

    // Hero avatar
    renderHeroAvatar(p.profile_picture, p.first_name, p.last_name);

    // Update topbar avatar
    updateTopbarAvatar(p.profile_picture, p.first_name, p.last_name);

    // Update sidebar avatar
    updateSidebarAvatar(p.profile_picture, p.first_name, p.last_name);
}

function renderHeroAvatar(picturePath, firstName, lastName) {
    const container = document.getElementById('heroAvatarContainer');
    if (!container) return;

    if (picturePath) {
        const url = getProfilePictureUrl(picturePath);
        container.innerHTML = `<img class="profile-avatar-img" src="${url}" alt="Profile Photo" onerror="this.style.display='none';renderHeroInitials('${firstName}','${lastName}')" />`;
    } else {
        renderHeroInitials(firstName, lastName);
    }
}

function renderHeroInitials(firstName, lastName) {
    const container = document.getElementById('heroAvatarContainer');
    if (!container) return;
    container.innerHTML = `
        <div class="profile-avatar-initials">
            ${(firstName||'')[0]}${(lastName||'')[0]}
        </div>
    `;
}

function updateTopbarAvatar(picturePath, firstName, lastName) {
    const el = document.getElementById('topbarAvatar');
    if (!el) return;
    if (picturePath) {
        const url = getProfilePictureUrl(picturePath);
        el.style.backgroundImage = `url('${url}')`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.textContent = '';
    } else {
        el.style.backgroundImage = 'none';
        el.textContent = `${(firstName||'')[0]}${(lastName||'')[0]}`.toUpperCase();
    }
}

// ============================================================
// POPULATE PROFILE INFO FORM
// ============================================================
function populateProfileForm(p) {
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    setVal('profileFirstName', p.first_name);
    setVal('profileLastName', p.last_name);
    setVal('profileEmail', p.email);
    setVal('profilePhone', p.phone);
    setVal('profileBio', p.bio);

    // Last updated
    const lu = document.getElementById('profileLastUpdated');
    if (lu && p.created_at) lu.textContent = `Joined: ${p.created_at.split('T')[0]}`;

    // Role-specific readonly fields
    const roleSection = document.getElementById('roleSpecificInfo');
    const roleFields = document.getElementById('roleSpecificFields');
    if (!roleSection || !roleFields) return;

    let fieldsHtml = '';
    if (p.role === 'student' && p.matric_number) {
        fieldsHtml = `
            <div><span style="color:var(--text-muted);font-size:11px;display:block;margin-bottom:2px;">MATRIC NUMBER</span><span style="color:var(--gold);font-family:monospace;">${p.matric_number}</span></div>
            <div><span style="color:var(--text-muted);font-size:11px;display:block;margin-bottom:2px;">LEVEL</span><span style="color:var(--teal);">${p.level} Level</span></div>
            <div><span style="color:var(--text-muted);font-size:11px;display:block;margin-bottom:2px;">DEPARTMENT</span><span>${p.department_name || '—'}</span></div>
        `;
        roleSection.style.display = 'block';
    } else if (p.role === 'lecturer' && p.staff_id) {
        fieldsHtml = `
            <div><span style="color:var(--text-muted);font-size:11px;display:block;margin-bottom:2px;">STAFF ID</span><span style="color:var(--gold);font-family:monospace;">${p.staff_id}</span></div>
            <div><span style="color:var(--text-muted);font-size:11px;display:block;margin-bottom:2px;">TITLE</span><span>${p.title || '—'}</span></div>
            <div><span style="color:var(--text-muted);font-size:11px;display:block;margin-bottom:2px;">DEPARTMENT</span><span>${p.department_name || '—'}</span></div>
            <div><span style="color:var(--text-muted);font-size:11px;display:block;margin-bottom:2px;">SPECIALIZATION</span><span>${p.specialization || '—'}</span></div>
        `;
        roleSection.style.display = 'block';
    }
    if (fieldsHtml) roleFields.innerHTML = fieldsHtml;
}

// ============================================================
// PROFILE INFO FORM SUBMIT
// ============================================================
function setupProfileInfoForm() {
    const form = document.getElementById('profileInfoForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('profileInfoBtn');
        btn.disabled = true;
        btn.textContent = 'Saving...';

        const data = {
            first_name: document.getElementById('profileFirstName').value.trim(),
            last_name: document.getElementById('profileLastName').value.trim(),
            phone: document.getElementById('profilePhone').value.trim(),
            bio: document.getElementById('profileBio').value.trim()
        };

        const res = await apiFetch('/profile/update', { method: 'PUT', body: JSON.stringify(data) });
        btn.disabled = false;
        btn.textContent = '💾 Save Changes';

        if (!res) return;
        if (res.data.success) {
            showToast('success', 'Profile Updated', 'Your information has been saved.');
            refreshLocalUser({ firstName: data.first_name, lastName: data.last_name });
            // Update hero
            document.getElementById('heroName').textContent = `${data.first_name} ${data.last_name}`;
            populateSidebarUser({ ...getUser(), firstName: data.first_name, lastName: data.last_name });
        } else {
            showToast('error', 'Update Failed', res.data.message);
        }
    });
}

// ============================================================
// PICTURE UPLOAD
// ============================================================
function renderCurrentPicture(picturePath) {
    const display = document.getElementById('currentPictureDisplay');
    const label = document.getElementById('currentPictureLabel');
    const removeBtn = document.getElementById('removePictureBtn');
    if (!display) return;

    if (picturePath) {
        const url = getProfilePictureUrl(picturePath);
        display.innerHTML = `<img src="${url}" style="width:90px;height:90px;border-radius:50%;object-fit:cover;border:3px solid var(--gold);box-shadow:0 4px 16px rgba(201,162,39,0.3);margin:0 auto;display:block;" alt="Current Photo" />`;
        if (label) label.textContent = 'Current profile photo';
        if (removeBtn) removeBtn.style.display = 'inline-flex';
    } else {
        display.innerHTML = `<div style="width:90px;height:90px;border-radius:50%;background:var(--navy-light);border:3px dashed var(--border);display:flex;align-items:center;justify-content:center;font-size:32px;margin:0 auto;">👤</div>`;
        if (label) label.textContent = 'No profile photo set';
        if (removeBtn) removeBtn.style.display = 'none';
    }
}

function setupPictureUpload() {
    const input = document.getElementById('pictureFileInput');
    const uploadZone = document.getElementById('uploadZone');
    const previewImage = document.getElementById('previewImage');
    const previewPlaceholder = document.getElementById('previewPlaceholder');
    const uploadBtn = document.getElementById('uploadPictureBtn');
    if (!input) return;

    // Drag and drop
    uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    });

    input.addEventListener('change', () => {
        if (input.files[0]) handleFileSelect(input.files[0]);
    });

    function handleFileSelect(file) {
        // Validate type
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.type)) {
            showToast('error', 'Invalid File', 'Only JPG, PNG and WEBP images are allowed.');
            return;
        }
        // Validate size (3MB)
        if (file.size > 3 * 1024 * 1024) {
            showToast('error', 'File Too Large', 'Image must be under 3MB.');
            return;
        }

        selectedPictureFile = file;

        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImage.src = e.target.result;
            previewImage.style.display = 'block';
            if (previewPlaceholder) previewPlaceholder.style.display = 'none';
        };
        reader.readAsDataURL(file);

        if (uploadBtn) uploadBtn.disabled = false;
    }
}

async function uploadProfilePicture() {
    if (!selectedPictureFile) {
        showToast('info', 'No Image Selected', 'Please choose an image file first.');
        return;
    }

    const btn = document.getElementById('uploadPictureBtn');
    btn.disabled = true;
    btn.textContent = 'Uploading...';

    const formData = new FormData();
    formData.append('profile_picture', selectedPictureFile);

    const token = getToken();
    try {
        const response = await fetch(`http://localhost:5000/api/profile/upload-picture`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await response.json();

        btn.disabled = false;
        btn.textContent = '⬆️ Upload Photo';

        if (data.success) {
            showToast('success', 'Photo Uploaded', 'Your profile picture has been updated!');
            selectedPictureFile = null;

            // Update all avatar instances
            updateSidebarAvatar(data.picture_url, profileData.first_name, profileData.last_name);
            updateTopbarAvatar(data.picture_url, profileData.first_name, profileData.last_name);
            renderHeroAvatar(data.picture_url, profileData.first_name, profileData.last_name);
            renderCurrentPicture(data.picture_url);

            // Update cached profileData
            if (profileData) profileData.profile_picture = data.picture_url;
            refreshLocalUser({ profile_picture: data.picture_url });

            // Reset file input and preview
            const input = document.getElementById('pictureFileInput');
            const previewImage = document.getElementById('previewImage');
            const previewPlaceholder = document.getElementById('previewPlaceholder');
            if (input) input.value = '';
            if (previewImage) { previewImage.style.display = 'none'; previewImage.src = ''; }
            if (previewPlaceholder) previewPlaceholder.style.display = 'flex';
            btn.disabled = true;
        } else {
            showToast('error', 'Upload Failed', data.message);
        }
    } catch (err) {
        btn.disabled = false;
        btn.textContent = '⬆️ Upload Photo';
        showToast('error', 'Error', 'Could not connect to server.');
    }
}

async function removeProfilePicture() {
    const res = await apiFetch('/profile/remove-picture', { method: 'DELETE' });
    if (!res) return;
    if (res.data.success) {
        showToast('success', 'Photo Removed', 'Your profile picture has been removed.');
        if (profileData) profileData.profile_picture = null;
        refreshLocalUser({ profile_picture: null });
        renderCurrentPicture(null);
        renderHeroAvatar(null, profileData.first_name, profileData.last_name);
        updateSidebarAvatar(null, profileData.first_name, profileData.last_name);
        updateTopbarAvatar(null, profileData.first_name, profileData.last_name);
    } else {
        showToast('error', 'Error', res.data.message);
    }
}

// ============================================================
// CHANGE PASSWORD FORM
// ============================================================
function setupPasswordForm() {
    const form = document.getElementById('changePasswordForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const current_password = document.getElementById('currentPassword').value;
        const new_password = document.getElementById('newPassword').value;
        const confirm_password = document.getElementById('confirmPassword').value;

        if (new_password !== confirm_password) {
            showToast('error', 'Mismatch', 'New password and confirmation do not match.');
            return;
        }

        const btn = document.getElementById('changePasswordBtn');
        btn.disabled = true;
        btn.textContent = 'Updating...';

        const res = await apiFetch('/profile/change-password', {
            method: 'PUT',
            body: JSON.stringify({ current_password, new_password, confirm_password })
        });

        btn.disabled = false;
        btn.textContent = '🔑 Update Password';

        if (!res) return;
        if (res.data.success) {
            showToast('success', 'Password Changed', 'Your password has been updated. Please log in again.');
            form.reset();
            document.getElementById('passwordStrengthFill').style.width = '0%';
            document.getElementById('passwordStrengthLabel').textContent = '';
            // Auto logout after password change for security
            setTimeout(() => logout(), 2500);
        } else {
            showToast('error', 'Failed', res.data.message);
        }
    });
}

// ============================================================
// PASSWORD STRENGTH INDICATOR
// ============================================================
function setupPasswordStrength() {
    const input = document.getElementById('newPassword');
    const fill = document.getElementById('passwordStrengthFill');
    const label = document.getElementById('passwordStrengthLabel');
    if (!input || !fill || !label) return;

    input.addEventListener('input', () => {
        const val = input.value;
        let strength = 0;
        if (val.length >= 6) strength++;
        if (val.length >= 10) strength++;
        if (/[A-Z]/.test(val)) strength++;
        if (/[0-9]/.test(val)) strength++;
        if (/[^A-Za-z0-9]/.test(val)) strength++;

        const levels = [
            { w: '0%', color: 'transparent', text: '' },
            { w: '25%', color: 'var(--danger)', text: '⚠️ Very Weak' },
            { w: '50%', color: 'var(--warning)', text: '🟡 Fair' },
            { w: '75%', color: 'var(--gold)', text: '🟠 Good' },
            { w: '90%', color: 'var(--teal)', text: '🔵 Strong' },
            { w: '100%', color: 'var(--success)', text: '✅ Very Strong' }
        ];

        const level = levels[Math.min(strength, 5)];
        fill.style.width = level.w;
        fill.style.background = level.color;
        label.textContent = level.text;
        label.style.color = level.color;
    });
}

// ============================================================
// PASSWORD MATCH INDICATOR
// ============================================================
function setupPasswordMatch() {
    const confirm = document.getElementById('confirmPassword');
    const msg = document.getElementById('passwordMatchMsg');
    if (!confirm || !msg) return;

    confirm.addEventListener('input', () => {
        const newPw = document.getElementById('newPassword').value;
        if (!confirm.value) { msg.textContent = ''; return; }
        if (confirm.value === newPw) {
            msg.innerHTML = '<span style="color:var(--success);">✅ Passwords match</span>';
        } else {
            msg.innerHTML = '<span style="color:var(--danger);">❌ Passwords do not match</span>';
        }
    });
}

// ============================================================
// PROFILE TAB SWITCHING
// ============================================================
function switchProfileTab(tab) {
    document.querySelectorAll('.profile-tab').forEach((t, i) => {
        const tabs = ['info', 'picture', 'password'];
        t.classList.toggle('active', tabs[i] === tab);
    });
    document.querySelectorAll('.profile-tab-content').forEach(c => c.classList.remove('active'));
    const tabMap = { info: 'profileTabInfo', picture: 'profileTabPicture', password: 'profileTabPassword' };
    const el = document.getElementById(tabMap[tab]);
    if (el) el.classList.add('active');
}

// ============================================================
// PASSWORD FIELD TOGGLE (show/hide)
// ============================================================
function togglePasswordField(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    btn.textContent = isHidden ? '🙈' : '👁️';
}
