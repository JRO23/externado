/* ============================================
   ADMIN.JS — Panel de administración con Supabase
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
    await Auth.init();
    updateNavAuth();
    const user = Auth.currentUser();

    if (!user || user.role !== 'admin') {
        document.getElementById('page-gate').style.display = 'block';
        document.getElementById('admin-content').style.display = 'none';
    } else {
        await initAdmin();
    }
});

async function onLoginSuccess(user) {
    updateNavAuth();
    if (user.role !== 'admin') {
        showNotification('⛔ Sin acceso', 'Tu cuenta no tiene permisos de administrador.', 'warning');
        return;
    }
    document.getElementById('page-gate').style.display = 'none';
    await initAdmin();
}

async function initAdmin() {
    document.getElementById('admin-content').style.display = 'block';
    await renderAdminKPIs();
    await renderAdminRequests();
    highlightNavLink('anav-requests');
}

/* ---------- PANEL SWITCHING ---------- */
function switchAdminPanel(name) {
    document.querySelectorAll('.admin-panel').forEach(p => p.style.display = 'none');
    document.getElementById('apanel-' + name).style.display = 'block';
    document.querySelectorAll('.nav-link[id^="anav-"]').forEach(l => l.classList.remove('active'));
    highlightNavLink('anav-' + name);

    if (name === 'reports')  renderAdminReports();
    if (name === 'users')    renderAdminUsers();
    if (name === 'routes')   renderAdminRoutes();
    if (name === 'requests') renderAdminRequests();
}

function highlightNavLink(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}

/* ---------- KPIs ---------- */
async function renderAdminKPIs() {
    const [requests, reports, users, routes] = await Promise.all([
        DB.getRequests(),
        DB.getReports(),
        DB.getUsers(),
        Promise.resolve(DB.getRoutes()),
    ]);

    const kpis = [
        { icon: '🛡️', value: requests.length,                                   label: 'Solicitudes totales' },
        { icon: '⏳', value: requests.filter(r => r.status === 'pending').length, label: 'Pendientes' },
        { icon: '✅', value: requests.filter(r => r.status === 'accepted').length,label: 'Aceptadas' },
        { icon: '🚨', value: reports.length,                                     label: 'Reportes' },
        { icon: '👥', value: users.length,                                       label: 'Usuarios' },
        { icon: '🚶', value: routes.length,                                      label: 'Rutas activas' },
    ];

    const grid = document.getElementById('admin-kpi');
    if (grid) grid.innerHTML = kpis.map(k => `
        <div class="kpi-card">
            <div class="kpi-icon">${k.icon}</div>
            <div class="kpi-value">${k.value}</div>
            <div class="kpi-label">${k.label}</div>
        </div>`).join('');
}

/* ---------- REQUESTS ---------- */
async function renderAdminRequests() {
    const tbody     = document.getElementById('admin-requests-tbody');
    const filterSel = document.getElementById('filter-status');
    const filterVal = filterSel ? filterSel.value : 'all';

    if (tbody) tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><span class="icon">⏳</span>Cargando...</div></td></tr>`;

    let requests = await DB.getRequests();
    if (filterVal !== 'all') requests = requests.filter(r => r.status === filterVal);

    if (requests.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><span class="icon">📭</span>No hay solicitudes${filterVal !== 'all' ? ' con este estado' : ''}.</div></td></tr>`;
        return;
    }

    tbody.innerHTML = requests.map(r => {
        const s = statusInfo(r.status);
        return `<tr>
            <td style="font-size:0.82rem;">${r.userEmail || '—'}</td>
            <td><strong>${r.origin}</strong><br><span style="color:var(--mid);font-size:0.75rem;">→ ${r.dest}</span></td>
            <td>${r.time || '—'}</td>
            <td>${r.people}</td>
            <td style="max-width:130px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:0.78rem;color:var(--mid);">${r.notes || '—'}</td>
            <td><span class="status-badge ${s.cls}">${s.label}</span></td>
            <td>
                <div style="display:flex;gap:5px;flex-wrap:wrap;">
                    ${r.status === 'pending'  ? `<button class="action-btn accept" onclick="setStatus(${r.id},'accepted')">✅ Aceptar</button>` : ''}
                    ${r.status === 'accepted' ? `<button class="action-btn finish" onclick="setStatus(${r.id},'finished')">🏁 Finalizar</button>` : ''}
                    ${r.status !== 'rejected' && r.status !== 'finished' ? `<button class="action-btn reject" onclick="setStatus(${r.id},'rejected')">✕ Rechazar</button>` : ''}
                </div>
            </td>
        </tr>`;
    }).join('');
}

async function setStatus(id, status) {
    await DB.updateRequestStatus(id, status);
    await renderAdminRequests();
    await renderAdminKPIs();
    const labels = { accepted: 'Solicitud aceptada', finished: 'Solicitud finalizada', rejected: 'Solicitud rechazada' };
    showNotification('✅ Actualizado', labels[status] || 'Estado actualizado.', 'success');
}

/* ---------- REPORTS ---------- */
async function renderAdminReports() {
    const feed = document.getElementById('admin-reports-feed');
    if (!feed) return;
    feed.innerHTML = `<div class="empty-state"><span class="icon">⏳</span>Cargando...</div>`;

    const reports = await DB.getReports();

    if (reports.length === 0) {
        feed.innerHTML = `<div class="empty-state"><span class="icon">📭</span>Sin reportes aún.</div>`;
        return;
    }

    feed.innerHTML = reports.map(r => {
        const cls = DB.reportClass(r.type);
        return `<div class="report-item ${cls}" style="display:flex;gap:12px;align-items:flex-start;">
            <div style="flex:1;">
                <div class="report-header">
                    <span class="report-badge ${cls}">${r.type}</span>
                    <span class="report-time">${DB.timeAgo(r.time)}</span>
                </div>
                <div class="report-location">📍 ${r.location} &nbsp;|&nbsp; 👤 ${r.user}</div>
                <div class="report-text">"${r.desc}"</div>
            </div>
            <button onclick="deleteReport(${r.id})" style="background:none;border:none;cursor:pointer;color:var(--gray-400);font-size:1.1rem;" title="Eliminar">🗑️</button>
        </div>`;
    }).join('');
}

async function deleteReport(id) {
    await DB.deleteReport(id);
    await renderAdminReports();
    await renderAdminKPIs();
    showNotification('🗑️ Eliminado', 'El reporte ha sido eliminado.', 'warning');
}

/* ---------- USERS ---------- */
async function renderAdminUsers() {
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><span class="icon">⏳</span>Cargando...</div></td></tr>`;

    const users = await DB.getUsers();
    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><span class="icon">👥</span>Sin usuarios aún.</div></td></tr>`;
        return;
    }

    const roleLabel = { student: '🎓 Estudiante', staff: '👨‍🏫 Docente', admin: '🛡️ Admin' };
    tbody.innerHTML = users.map((u, i) => `
        <tr>
            <td style="color:var(--mid);font-size:0.8rem;">${i + 1}</td>
            <td><strong>${u.name} ${u.lastname || ''}</strong></td>
            <td style="font-size:0.82rem;">${u.email}</td>
            <td><span class="status-badge ${u.role === 'admin' ? 'status-rejected' : 'status-accepted'}">${roleLabel[u.role] || u.role}</span></td>
            <td style="font-size:0.78rem;color:var(--mid);">${new Date(u.joined_at || Date.now()).toLocaleDateString('es-CO')}</td>
        </tr>`).join('');
}

/* ---------- ROUTES ---------- */
function renderAdminRoutes() {
    const grid = document.getElementById('admin-routes-grid');
    if (!grid) return;
    const routes = DB.getRoutes();
    grid.innerHTML = routes.map(route => {
        const pct = Math.round((route.current / route.max) * 100);
        const fillClass = pct >= 90 ? 'full' : pct >= 60 ? 'medium' : '';
        return `<div class="route-card">
            <div class="route-card-header" style="background:${route.color};color:${route.textColor};">${route.station}</div>
            <div class="route-card-body">
                <div class="route-name">${route.name}</div>
                <div class="route-meta">🕐 ${route.time} | Puerta Principal</div>
                <div class="route-capacity">
                    <span class="route-cap-text">${route.current}/${route.max}</span>
                    <span style="font-size:0.72rem;color:var(--mid);font-weight:700;">${pct}%</span>
                </div>
                <div class="capacity-bar"><div class="capacity-fill ${fillClass}" style="width:${pct}%;"></div></div>
                <div style="display:flex;gap:8px;margin-top:10px;">
                    <button class="action-btn reject" onclick="deleteRoute(${route.id})">🗑️ Eliminar</button>
                    <button class="action-btn finish" onclick="resetRoute(${route.id})">↺ Resetear</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

function deleteRoute(id) {
    const routes = DB.getRoutes().filter(r => r.id !== id);
    DB.saveRoutes(routes);
    renderAdminRoutes();
    renderAdminKPIs();
    showNotification('🗑️ Ruta eliminada', 'La ruta ha sido removida.', 'warning');
}

function resetRoute(id) {
    const routes = DB.getRoutes();
    const route  = routes.find(r => r.id === id);
    if (route) { route.current = 0; DB.saveRoutes(routes); renderAdminRoutes(); showNotification('↺ Cupo reseteado', 'El cupo de la ruta vuelve a 0.', 'success'); }
}

function addNewRoute() {
    const name    = prompt('Nombre de la ruta (Ej: Entrada U → Chapinero):');
    if (!name) return;
    const station = prompt('Nombre del destino:') || name;
    const time    = prompt('Hora de salida (Ej: 04:00 PM):') || '12:00 PM';
    const max     = parseInt(prompt('Capacidad máxima:') || '15') || 15;
    const routes  = DB.getRoutes();
    routes.push({ id: Date.now(), name, station, time, current: 0, max, color: '#D32F2F', textColor: '#fff' });
    DB.saveRoutes(routes);
    renderAdminRoutes();
    showNotification('✅ Ruta creada', `"${name}" agregada exitosamente.`, 'success');
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
