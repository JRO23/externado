/* ============================================
   DASHBOARD.JS — Panel de usuario con Supabase
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
    await Auth.init();
    updateNavAuth();

    const user = Auth.currentUser();
    if (!user) {
        document.getElementById('page-gate').style.display = 'block';
        document.getElementById('dashboard-content').style.display = 'none';
    } else {
        document.getElementById('page-gate').style.display = 'none';
        document.getElementById('dashboard-content').style.display = 'block';
        await initDashboard(user);
    }
});

async function onLoginSuccess(user) {
    document.getElementById('page-gate').style.display = 'none';
    document.getElementById('dashboard-content').style.display = 'block';
    updateNavAuth();
    await initDashboard(user);
}

async function initDashboard(user) {
    const hello = document.getElementById('dash-hello');
    if (hello) hello.innerHTML = `Hola, <span>${user.name}</span> 👋`;
    await renderKPIs(user);
    await renderOverviewRequests(user);
    await renderRequestsTable(user);
    await renderMyReports(user);
    renderProfile(user);
}

/* ---------- PANEL SWITCHING ---------- */
function switchPanel(name) {
    document.querySelectorAll('.dash-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    document.getElementById('panel-' + name).classList.add('active');
    const sb = document.getElementById('sb-' + name);
    if (sb) sb.classList.add('active');
}

/* ---------- KPIs ---------- */
async function renderKPIs(user) {
    const requests = await DB.getRequestsByUser(user.email);
    const reports  = (await DB.getReports()).filter(r => r.user === user.email);

    const pending  = requests.filter(r => r.status === 'pending').length;
    const accepted = requests.filter(r => r.status === 'accepted').length;
    const finished = requests.filter(r => r.status === 'finished').length;

    const kpis = [
        { icon: '🛡️', value: requests.length, label: 'Total solicitudes' },
        { icon: '⏳', value: pending,          label: 'Pendientes' },
        { icon: '✅', value: accepted,         label: 'Aceptadas' },
        { icon: '🏁', value: finished,         label: 'Finalizadas' },
        { icon: '🚨', value: reports.length,   label: 'Reportes enviados' },
    ];

    const grid = document.getElementById('kpi-grid');
    if (grid) grid.innerHTML = kpis.map(k => `
        <div class="kpi-card">
            <div class="kpi-icon">${k.icon}</div>
            <div class="kpi-value">${k.value}</div>
            <div class="kpi-label">${k.label}</div>
        </div>`).join('');
}

/* ---------- OVERVIEW ---------- */
async function renderOverviewRequests(user) {
    const container = document.getElementById('overview-requests');
    if (!container) return;
    const requests = await DB.getRequestsByUser(user.email);

    if (requests.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="background:var(--white);border-radius:var(--radius-md);border:2px solid var(--gray-200);">
                <span class="icon">📭</span>
                Aún no has solicitado acompañamiento.
                <br><button onclick="openRequestModal()" class="btn-primary" style="margin-top:16px;">Solicitar ahora</button>
            </div>`;
        return;
    }

    container.innerHTML = `<div class="recent-requests">
        ${requests.slice(0, 5).map(r => {
            const s = statusInfo(r.status);
            return `<div class="req-item">
                <div class="req-item-icon">🛡️</div>
                <div class="req-item-info">
                    <div class="req-item-route">${r.origin} → ${r.dest}</div>
                    <div class="req-item-meta">🕐 ${r.time || '-'} &nbsp;|&nbsp; 👥 ${r.people} persona(s) &nbsp;|&nbsp; ${DB.timeAgo(r.createdAt)}</div>
                </div>
                <span class="status-badge ${s.cls}">${s.label}</span>
            </div>`;
        }).join('')}
    </div>`;
}

/* ---------- REQUESTS TABLE ---------- */
async function renderRequestsTable(user) {
    const tbody = document.getElementById('requests-tbody');
    if (!tbody) return;
    const requests = await DB.getRequestsByUser(user.email);

    if (requests.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><span class="icon">📭</span>Sin solicitudes</div></td></tr>`;
        return;
    }

    tbody.innerHTML = requests.map(r => {
        const s = statusInfo(r.status);
        return `<tr>
            <td><strong>${r.origin}</strong> → ${r.dest}</td>
            <td>${r.time || '—'}</td>
            <td>${r.people}</td>
            <td style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${r.notes || '—'}</td>
            <td><span class="status-badge ${s.cls}">${s.label}</span></td>
        </tr>`;
    }).join('');
}

/* ---------- MY REPORTS ---------- */
async function renderMyReports(user) {
    const container = document.getElementById('my-reports-list');
    if (!container) return;
    const reports = (await DB.getReports()).filter(r => r.user === user.email);

    if (reports.length === 0) {
        container.innerHTML = `<div class="empty-state"><span class="icon">📭</span>Aún no has enviado reportes.<br><a href="index.html#reportes" class="btn-primary" style="margin-top:16px;display:inline-block;">Ir al Radar</a></div>`;
        return;
    }

    container.innerHTML = `<div class="report-feed" style="max-height:none;">
        ${reports.map(r => {
            const cls = DB.reportClass(r.type);
            return `<div class="report-item ${cls}">
                <div class="report-header">
                    <span class="report-badge ${cls}">${r.type}</span>
                    <span class="report-time">${DB.timeAgo(r.time)}</span>
                </div>
                <div class="report-location">📍 ${r.location}</div>
                <div class="report-text">"${r.desc}"</div>
            </div>`;
        }).join('')}
    </div>`;
}

/* ---------- PROFILE ---------- */
function renderProfile(user) {
    const avatar = document.getElementById('profile-avatar');
    const info   = document.getElementById('profile-info');
    if (!avatar || !info) return;

    const initials = (user.name[0] + (user.lastname ? user.lastname[0] : '')).toUpperCase();
    avatar.textContent = initials;

    const roleLabel = { student: '🎓 Estudiante', staff: '👨‍🏫 Docente / Staff', admin: '🛡️ Administrador' };
    info.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:8px;">
            <div><strong style="font-size:1.2rem;">${user.name} ${user.lastname || ''}</strong></div>
            <div style="color:var(--mid);font-size:0.85rem;">📧 ${user.email}</div>
            <div style="color:var(--mid);font-size:0.85rem;">${roleLabel[user.role] || user.role}</div>
            <div style="color:var(--mid);font-size:0.78rem;">📅 Miembro desde ${new Date(user.joined_at || user.joinedAt || Date.now()).toLocaleDateString('es-CO')}</div>
        </div>`;
}

async function changePassword(e) {
    e.preventDefault();
    const newPass = document.getElementById('new-pass').value;
    const msg     = document.getElementById('pass-msg');

    if (newPass.length < 6) {
        msg.textContent = 'La nueva contraseña debe tener al menos 6 caracteres.';
        msg.style.display = 'block';
        return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) {
        msg.textContent = 'Error: ' + error.message;
        msg.style.display = 'block';
        return;
    }

    msg.style.display = 'none';
    e.target.reset();
    showNotification('✅ Contraseña actualizada', 'Tu contraseña ha sido cambiada exitosamente.', 'success');
}

/* ---------- REQUEST MODAL ---------- */
function openRequestModal() {
    if (!Auth.isLoggedIn()) { openAuthModal(); return; }
    const user = Auth.currentUser();
    const nameInput = document.getElementById('req-name');
    if (nameInput && user) nameInput.value = `${user.name} ${user.lastname || ''}`.trim();
    document.getElementById('request-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeRequestModal() {
    document.getElementById('request-modal').style.display = 'none';
    document.body.style.overflow = '';
}

async function submitRequest(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.textContent = 'Enviando...';
    btn.disabled = true;

    const user = Auth.currentUser();
    await DB.addRequest({
        name:      document.getElementById('req-name').value,
        origin:    document.getElementById('req-origin').value,
        dest:      document.getElementById('req-dest').value,
        time:      document.getElementById('req-time').value,
        people:    document.getElementById('req-people').value,
        notes:     document.getElementById('req-notes').value,
        userEmail: user ? user.email : 'anonimo',
    });

    closeRequestModal();
    e.target.reset();
    btn.textContent = 'Enviar Solicitud';
    btn.disabled = false;

    showNotification('✅ Solicitud enviada', '¡Tu solicitud fue registrada exitosamente!', 'success');

    await renderKPIs(user);
    await renderOverviewRequests(user);
    await renderRequestsTable(user);
}

/* ---------- HELPERS ---------- */
function statusInfo(status) {
    const map = {
        pending:  { label: 'Pendiente',  cls: 'status-pending' },
        accepted: { label: 'Aceptada',   cls: 'status-accepted' },
        finished: { label: 'Finalizada', cls: 'status-finished' },
        rejected: { label: 'Rechazada',  cls: 'status-rejected' },
    };
    return map[status] || map.pending;
}

document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.style.display = 'none';
            document.body.style.overflow = '';
        }
    });
});
