/* ============================================
   APP.JS — Main page logic
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    updateNavAuth();
    renderReports();
    renderRoutes();
    renderRecentRequestsPreview();
    initSOS();
});

/* ============================================
   REPORTS / INCIDENTS
   ============================================ */
function renderReports() {
    const list = document.getElementById('report-list');
    if (!list) return;
    const reports = DB.getReports();
    list.innerHTML = '';
    reports.slice(0, 8).forEach(r => {
        const cls = DB.reportClass(r.type);
        list.innerHTML += `
            <div class="report-item ${cls}">
                <div class="report-header">
                    <span class="report-badge ${cls}">${r.type}</span>
                    <span class="report-time">${DB.timeAgo(r.time)}</span>
                </div>
                <div class="report-location">📍 ${r.location}</div>
                <div class="report-text">"${r.desc}"</div>
            </div>`;
    });
}

function openReportModal() {
    document.getElementById('report-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeReportModal() {
    document.getElementById('report-modal').style.display = 'none';
    document.body.style.overflow = '';
}

function submitReport(e) {
    e.preventDefault();
    const user = Auth.currentUser();
    const type     = document.getElementById('report-type').value;
    const location = document.getElementById('report-location').value;
    const desc     = document.getElementById('report-desc').value;

    DB.addReport({ type, location, desc, time: Date.now(), user: user ? user.email : 'Anónimo' });
    renderReports();
    closeReportModal();
    e.target.reset();
    showNotification('✅ Reporte publicado', 'La comunidad ya puede ver tu alerta.', 'success');

    // Animate new map alert
    addMapAlert();
}

function addMapAlert() {
    const map = document.getElementById('map-container');
    if (!map) return;
    const dot = document.createElement('div');
    dot.className = 'map-point alert';
    const top  = Math.floor(Math.random() * 60 + 15);
    const left = Math.floor(Math.random() * 60 + 15);
    dot.style.top  = top + '%';
    dot.style.left = left + '%';
    dot.innerHTML = '<span class="map-label">NUEVO</span>';
    dot.onclick = () => showNotification('🚨 ALERTA', 'Nuevo incidente reportado.');
    map.appendChild(dot);
    setTimeout(() => dot.remove(), 12000);
}

/* ============================================
   ROUTES — Caravanas
   ============================================ */
function renderRoutes() {
    const grid = document.getElementById('routes-grid');
    if (!grid) return;
    const routes = DB.getRoutes();
    grid.innerHTML = '';
    routes.forEach(route => {
        const pct = Math.round((route.current / route.max) * 100);
        const fillClass = pct >= 90 ? 'full' : pct >= 60 ? 'medium' : '';
        const isFull = route.current >= route.max;
        grid.innerHTML += `
            <div class="route-card">
                <div class="route-card-header" style="background:${route.color}; color:${route.textColor};">
                    ${route.station}
                </div>
                <div class="route-card-body">
                    <div class="route-name">${route.name}</div>
                    <div class="route-meta">🕐 SALIDA: ${route.time} &nbsp;|&nbsp; 📍 Puerta Principal</div>
                    <div class="route-capacity">
                        <span class="route-cap-text" id="cap-${route.id}">${route.current}/${route.max}</span>
                        <span style="font-size:0.72rem;color:var(--mid);font-weight:700;">${pct}% lleno</span>
                    </div>
                    <div class="capacity-bar">
                        <div class="capacity-fill ${fillClass}" style="width:${pct}%;"></div>
                    </div>
                    <button
                        onclick="joinRoute(${route.id})"
                        class="btn-primary w-full"
                        ${isFull ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}
                    >${isFull ? '🔒 Cupo lleno' : '🚶 Unirse a la ruta'}</button>
                </div>
            </div>`;
    });
}

function joinRoute(id) {
    const success = DB.joinRoute(id);
    if (success) {
        renderRoutes();
        showNotification('🚶 ¡Unido!', 'Te has unido a la ruta. ¡Nos vemos en la entrada!', 'success');
    } else {
        showNotification('🔒 Sin cupo', 'Esta ruta ya está llena. Elige otra.', 'warning');
    }
}

/* ============================================
   REQUEST ACCOMPANIMENT
   ============================================ */
function openRequestModal() {
    if (!Auth.isLoggedIn()) {
        showNotification('🔐 Inicia sesión', 'Debes estar registrado para solicitar acompañamiento.', 'warning');
        openAuthModal();
        return;
    }
    const user = Auth.currentUser();
    const nameInput = document.getElementById('req-name');
    if (nameInput) nameInput.value = `${user.name} ${user.lastname}`;
    document.getElementById('request-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeRequestModal() {
    document.getElementById('request-modal').style.display = 'none';
    document.body.style.overflow = '';
}

function submitRequest(e) {
    e.preventDefault();
    const user = Auth.currentUser();
    const req = {
        name:      document.getElementById('req-name').value,
        origin:    document.getElementById('req-origin').value,
        dest:      document.getElementById('req-dest').value,
        time:      document.getElementById('req-time').value,
        people:    document.getElementById('req-people').value,
        notes:     document.getElementById('req-notes').value,
        userEmail: user ? user.email : 'anonimo',
    };
    DB.addRequest(req);
    closeRequestModal();
    e.target.reset();
    showNotification('✅ Solicitud enviada', 'Revisaremos tu solicitud pronto. ¡Estás en buenas manos!', 'success');
    renderRecentRequestsPreview();
}

function renderRecentRequestsPreview() {
    const user = Auth.currentUser();
    const section = document.getElementById('mis-solicitudes-preview');
    const list = document.getElementById('recent-requests-list');
    if (!section || !list) return;

    if (!user) { section.style.display = 'none'; return; }
    const requests = DB.getRequestsByUser(user.email);
    if (requests.length === 0) { section.style.display = 'none'; return; }

    section.style.display = 'block';
    list.innerHTML = '';
    requests.slice(0, 3).forEach(r => {
        const statusMap = {
            pending:  { label: 'Pendiente', cls: 'status-pending' },
            accepted: { label: 'Aceptada',  cls: 'status-accepted' },
            finished: { label: 'Finalizada',cls: 'status-finished' },
            rejected: { label: 'Rechazada', cls: 'status-rejected' },
        };
        const s = statusMap[r.status] || statusMap.pending;
        list.innerHTML += `
            <div class="req-item">
                <div class="req-item-icon">🛡️</div>
                <div class="req-item-info">
                    <div class="req-item-route">${r.origin} → ${r.dest}</div>
                    <div class="req-item-meta">🕐 ${r.time || '-'} &nbsp;|&nbsp; 👥 ${r.people} persona(s)</div>
                </div>
                <span class="status-badge ${s.cls}">${s.label}</span>
            </div>`;
    });
}

// Called after login to refresh the UI
function onLoginSuccess(user) {
    renderRecentRequestsPreview();
    updateNavAuth();
}

/* ============================================
   SOS BUTTON
   ============================================ */
function initSOS() {
    const sosBtn     = document.getElementById('sos-btn');
    const sosOverlay = document.getElementById('sos-overlay');
    const sosCancel  = document.getElementById('sos-cancel');
    const sosTimer   = document.getElementById('sos-timer');

    if (!sosBtn || !sosOverlay) return;

    let countdown = null;

    sosBtn.onclick = () => {
        sosOverlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        let secs = 5;
        sosTimer.textContent = `Notificando en ${secs}...`;
        countdown = setInterval(() => {
            secs--;
            if (secs <= 0) {
                clearInterval(countdown);
                sosTimer.textContent = '🚨 ALERTAS ENVIADAS';
            } else {
                sosTimer.textContent = `Notificando en ${secs}...`;
            }
        }, 1000);
    };

    sosCancel.onclick = () => {
        clearInterval(countdown);
        sosOverlay.style.display = 'none';
        document.body.style.overflow = '';
        sosTimer.textContent = 'Notificando en 5...';
        showNotification('✅ Alerta cancelada', 'El protocolo SOS ha sido desactivado.', 'success');
    };
}

/* ============================================
   CLOSE MODALS BY CLICKING BACKDROP
   ============================================ */
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.style.display = 'none';
            document.body.style.overflow = '';
        }
    });
});

/* ============================================
   ANIMATED LIVE STATS
   ============================================ */
(function animateStats() {
    function count(el, end, start = 0) {
        if (!el) return;
        let cur = start;
        const step = Math.ceil((end - start) / 40);
        const t = setInterval(() => {
            cur = Math.min(cur + step, end);
            el.textContent = cur;
            if (cur >= end) clearInterval(t);
        }, 30);
    }
    count(document.getElementById('stat-users'),   247);
    count(document.getElementById('stat-reports'),  58);
    count(document.getElementById('stat-routes'),   12);
})();
