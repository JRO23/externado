/* ============================================
   APP.JS — Lógica de la página principal
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
    // Inicializar autenticación con Supabase
    await Auth.init();

    renderRoutes();
    await renderReports();
    await renderRecentRequestsPreview();
    initSOS();
    animateStats();
});

// Cargar marcadores de incidentes en el mapa (espera a que Leaflet init)
window.addEventListener('load', function() {
    setTimeout(function() { RadarMap.loadIncidents(); }, 500);
});

/* ============================================
   REPORTES / INCIDENTES
   ============================================ */
async function renderReports() {
    const list = document.getElementById('report-list');
    if (!list) return;

    list.innerHTML = `<div class="empty-state"><span class="icon">⏳</span>Cargando reportes...</div>`;

    const reports = await DB.getReports();
    list.innerHTML = '';

    if (reports.length === 0) {
        list.innerHTML = `<div class="empty-state"><span class="icon">📭</span>Sin reportes recientes.</div>`;
        return;
    }

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

async function submitReport(e) {
    e.preventDefault();
    const btn  = e.target.querySelector('button[type="submit"]');
    btn.textContent = 'Publicando...';
    btn.disabled = true;

    const type     = document.getElementById('report-type').value;
    const location = document.getElementById('report-location').value;
    const desc     = document.getElementById('report-desc').value;

    await DB.addReport({ type, location, desc });
    await renderReports();
    closeReportModal();
    e.target.reset();

    btn.textContent = 'Publicar Reporte';
    btn.disabled = false;

    showNotification('✅ Reporte publicado', 'La comunidad ya puede ver tu alerta.', 'success');

    // Añadir marcador real en el mapa Leaflet
    RadarMap.addLiveAlert({
        type:     document.getElementById('report-type')?.value || 'Otro',
        location: document.getElementById('report-location')?.value || '',
        desc:     document.getElementById('report-desc')?.value || '',
        time:     Date.now(),
    });
}


/* ============================================
   RUTAS — Caravanas
   ============================================ */
function renderRoutes() {
    const grid = document.getElementById('routes-grid');
    if (!grid) return;
    const routes = DB.getRoutes();
    grid.innerHTML = '';
    routes.forEach(route => {
        const pct = Math.round((route.current / route.max) * 100);
        const fillClass = pct >= 90 ? 'full' : pct >= 60 ? 'medium' : '';
        const isFull    = route.current >= route.max;
        grid.innerHTML += `
            <div class="route-card">
                <div class="route-card-header" style="background:${route.color};color:${route.textColor};">
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
                    <button onclick="joinRoute(${route.id})" class="btn-primary w-full"
                        ${isFull ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
                        ${isFull ? '🔒 Cupo lleno' : '🚶 Unirse a la ruta'}
                    </button>
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
   SOLICITAR ACOMPAÑAMIENTO
   ============================================ */
function openRequestModal() {
    if (!Auth.isLoggedIn()) {
        showNotification('🔐 Inicia sesión', 'Debes estar registrado para solicitar acompañamiento.', 'warning');
        openAuthModal();
        return;
    }
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

    showNotification('✅ Solicitud enviada', '¡Estás en buenas manos! Revisaremos tu solicitud pronto.', 'success');
    await renderRecentRequestsPreview();
}

async function renderRecentRequestsPreview() {
    const user    = Auth.currentUser();
    const section = document.getElementById('mis-solicitudes-preview');
    const list    = document.getElementById('recent-requests-list');
    if (!section || !list) return;
    if (!user) { section.style.display = 'none'; return; }

    const requests = await DB.getRequestsByUser(user.email);
    if (requests.length === 0) { section.style.display = 'none'; return; }

    section.style.display = 'block';
    list.innerHTML = '';
    const statusMap = {
        pending:  { label: 'Pendiente', cls: 'status-pending' },
        accepted: { label: 'Aceptada',  cls: 'status-accepted' },
        finished: { label: 'Finalizada',cls: 'status-finished' },
        rejected: { label: 'Rechazada', cls: 'status-rejected' },
    };
    requests.slice(0, 3).forEach(r => {
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

// Hook post-login
async function onLoginSuccess(user) {
    await renderRecentRequestsPreview();
    updateNavAuth();
}

/* ============================================
   SOS
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
   CERRAR MODALES AL HACER CLICK EN FONDO
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
   CONTADOR ANIMADO EN HERO
   ============================================ */
function animateStats() {
    function count(el, end) {
        if (!el) return;
        let cur = 0;
        const step = Math.ceil(end / 40);
        const t = setInterval(() => {
            cur = Math.min(cur + step, end);
            el.textContent = cur;
            if (cur >= end) clearInterval(t);
        }, 30);
    }
    count(document.getElementById('stat-users'),   247);
    count(document.getElementById('stat-reports'),  58);
    count(document.getElementById('stat-routes'),   12);
}
