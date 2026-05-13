/* ============================================
   APP.JS — Lógica de la página principal
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
    // Inicializar autenticación con Supabase (sin bloquear si falla)
    try { await Auth.init(); } catch(e) { console.warn('Auth init error:', e); }

    renderFeaturedRoutes();
    renderRoutes();
    renderTicker();
    renderActivityFeed();
    renderRouteStatusList();

    try { await renderReports(); } catch(e) { console.warn('renderReports error:', e); }
    try { await renderRecentRequestsPreview(); } catch(e) {}

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

/* --- 4 Cuadros Destacados --- */
function renderFeaturedRoutes() {
    const container = document.getElementById('featured-routes');
    if (!container) return;
    const routes = DB.getRoutes();
    // Mostrar solo las primeras 4 rutas como cuadros destacados
    const featured = routes.slice(0, 4);
    container.innerHTML = featured.map((route, i) => {
        const isFull = route.current >= route.max;
        const pct    = Math.round((route.current / route.max) * 100);
        const spotsLeft = route.max - route.current;
        return `
        <div class="feat-card" id="feat-card-${route.id}" style="--feat-color:${route.color};">
            <div class="feat-card-top" style="background:${route.color};">
                <div class="feat-destination-label">DESTINO</div>
                <div class="feat-destination">${route.station}</div>
                <div class="feat-time">🕐 Salida ${route.time} &nbsp;·&nbsp; ${route.duration || 'Puerta Principal'}</div>
            </div>
            <div class="feat-card-body">
                <div class="feat-people-section">
                    <div class="feat-people-count" id="feat-count-${route.id}">${route.current}</div>
                    <div class="feat-people-label">personas unidas</div>
                    <div class="feat-capacity-row">
                        <div class="feat-cap-bar">
                            <div class="feat-cap-fill" style="width:${pct}%; background:${route.color};"></div>
                        </div>
                        <span class="feat-cap-spots ${isFull ? 'feat-full' : ''}">${
                            isFull ? '🔒 Cupo lleno' : `${spotsLeft} cupo${spotsLeft !== 1 ? 's' : ''} libre${spotsLeft !== 1 ? 's' : ''}`
                        }</span>
                    </div>
                </div>
                ${route.desc ? `<div class="feat-desc">${route.desc}</div>` : ''}
                <button
                    onclick="joinFeaturedRoute(${route.id})"
                    class="feat-join-btn"
                    id="feat-btn-${route.id}"
                    style="background:${route.color}; border-color:${route.color};"
                    ${isFull ? 'disabled' : ''}>
                    ${isFull ? '🔒 Cupo Lleno' : '🚶 Unirse a esta Ruta'}
                </button>
            </div>
        </div>`;
    }).join('');
}

function joinFeaturedRoute(id) {
    const success = DB.joinRoute(id);
    if (success) {
        renderFeaturedRoutes();
        renderRoutes();
        renderRouteStatusList();
        const route = DB.getRoutes().find(r => r.id === id);
        if (route) pushActivityNotif({
            type:   'joined',
            icon:   '🚶',
            route:  route.name,
            detail: `Una persona se unió a la caravana hacia ${route.station}. Cupos restantes: ${route.max - route.current}`,
            time:   Date.now(),
        });
        showNotification('🚶 ¡Unido!', 'Te has unido a la ruta. ¡Nos vemos en la entrada!', 'success');
    } else {
        showNotification('🔒 Sin cupo', 'Esta ruta ya está llena. Elige otra.', 'warning');
    }
}

function renderRoutes() {
    const grid = document.getElementById('routes-grid');
    if (!grid) return;
    const routes = DB.getRoutes();
    grid.innerHTML = '';
    routes.forEach(route => {
        const pct       = Math.round((route.current / route.max) * 100);
        const fillClass = pct >= 90 ? 'full' : pct >= 60 ? 'medium' : '';
        const isFull    = route.current >= route.max;
        grid.innerHTML += `
            <div class="route-card">
                <div class="route-card-header" style="background:${route.color};color:${route.textColor};">
                    ${route.station}
                </div>
                <div class="route-card-body">
                    <div class="route-name">${route.name}</div>
                    <div class="route-meta">🕐 SALIDA: ${route.time} &nbsp;|&nbsp; 🚶 ${route.duration || 'Puerta Principal'}</div>
                    ${route.desc ? `<div class="route-desc">${route.desc}</div>` : ''}
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
        renderFeaturedRoutes();
        renderRoutes();
        renderRouteStatusList();
        // Push live notification
        const routes = DB.getRoutes();
        const route  = routes.find(r => r.id === id);
        if (route) pushActivityNotif({
            type:    'joined',
            icon:    '🚶',
            route:   route.name,
            detail:  `Una persona se unió a la caravana hacia ${route.station}. Cupos restantes: ${route.max - route.current}`,
            time:    Date.now(),
        });
        showNotification('🚶 ¡Unido!', 'Te has unido a la ruta. ¡Nos vemos en la entrada!', 'success');
    } else {
        showNotification('🔒 Sin cupo', 'Esta ruta ya está llena. Elige otra.', 'warning');
    }
}

/* ============================================
   TICKER — BARRA DE ACTIVIDAD SUPERIOR
   ============================================ */
function renderTicker() {
    const inner = document.getElementById('ticker-inner');
    if (!inner) return;

    const routes = DB.getRoutes();
    const msgs = [
        ...routes.map(r => {
            const pct = Math.round((r.current / r.max) * 100);
            return `🚶 <strong>${r.current} personas</strong> en caravana → ${r.station} · Salida ${r.time}`;
        }),
        '⚡ Más de <strong>247 usuarios</strong> activos en la plataforma hoy',
        '🔒 Recuerda activar el botón <strong>SOS</strong> en caso de emergencia',
        '🤝 ¿Necesitas escolta? Solicita acompañamiento personalizado',
        '📡 El radar de incidencias se actualiza en tiempo real',
    ];

    // Duplicar para scroll infinito
    const allMsgs = [...msgs, ...msgs];
    inner.innerHTML = allMsgs.map(m =>
        `<span class="ticker-item"><span class="ticker-dot"></span>${m}</span>`
    ).join('');
}

/* ============================================
   SECCIÓN ACTIVIDAD EN VIVO
   ============================================ */

// Buffer de notificaciones en memoria
const _activityLog = [];

function _timeLabel(ts) {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60)   return 'AHORA';
    if (diff < 3600) return `HACE ${Math.floor(diff/60)} MIN`;
    return `HACE ${Math.floor(diff/3600)} H`;
}

function pushActivityNotif(notif) {
    _activityLog.unshift(notif);
    renderActivityFeed();
    renderRouteStatusList();
}

function renderActivityFeed() {
    const list   = document.getElementById('activity-list');
    const count  = document.getElementById('activity-count');
    if (!list) return;

    const routes = DB.getRoutes();

    // Generar notificaciones de ejemplo si el log está vacío
    if (_activityLog.length === 0) {
        const now = Date.now();
        const m   = 60 * 1000;
        const seed = [
            { type:'joined', icon:'🚶', route: routes[0]?.name || 'Ruta 1',
              detail: `3 personas se unieron. Cupos restantes: ${routes[0] ? routes[0].max - routes[0].current : 6}`,
              time: now - 2*m },
            { type:'joined', icon:'🚶', route: routes[3]?.name || 'Ruta 4',
              detail: `1 persona se unió a la caravana hacia ${routes[3]?.station || 'La Candelaria'}.`,
              time: now - 7*m },
            { type:'joined', icon:'🚶', route: routes[6]?.name || 'Ruta 7',
              detail: `2 personas confirmaron su lugar hacia ${routes[6]?.station || 'Centro Internacional'}.`,
              time: now - 12*m },
            { type:'full',   icon:'🔒', route: routes[2]?.name || 'Ruta 3',
              detail: `Cupo completo en la caravana a ${routes[2]?.station || 'San Victorino'}. Salida en ${routes[2]?.time || '5:30 PM'}.`,
              time: now - 18*m },
            { type:'joined', icon:'🚶', route: routes[1]?.name || 'Ruta 2',
              detail: `4 personas ya están listas para la salida hacia ${routes[1]?.station || 'Av. Jiménez'}.`,
              time: now - 25*m },
            { type:'joined', icon:'🚶', route: routes[4]?.name || 'Ruta 5',
              detail: `Caravana al ${routes[4]?.station || 'Portal El Dorado'} con 7 confirmados. Únete antes de las ${routes[4]?.time || '6:00 PM'}.`,
              time: now - 34*m },
            { type:'joined', icon:'🚶', route: routes[7]?.name || 'Ruta 8',
              detail: `Nuevo grupo formado hacia ${routes[7]?.station || 'Museo Nacional'}. Solo 8 cupos disponibles.`,
              time: now - 41*m },
            { type:'joined', icon:'🚶', route: routes[5]?.name || 'Ruta 6',
              detail: `Caravana nocturna a ${routes[5]?.station || 'Chapinero'} confirmada. Salen desde la puerta principal.`,
              time: now - 55*m },
            { type:'full',   icon:'🔒', route: routes[8]?.name || 'Ruta 9',
              detail: `¡Cupo lleno! La caravana al ${routes[8]?.station || 'Terminal del Sur'} ya no tiene plazas.`,
              time: now - 68*m },
            { type:'joined', icon:'🚶', route: routes[9]?.name || 'Ruta 10',
              detail: `Primera persona confirmada en la caravana a ${routes[9]?.station || 'Calle 100'}. ¡Únete tú también!`,
              time: now - 80*m },
        ];
        seed.forEach(s => _activityLog.push(s));
    }

    list.innerHTML = _activityLog.map(n => `
        <div class="activity-notif ${n.type}">
            <span class="notif-icon">${n.icon}</span>
            <div class="notif-body">
                <div class="notif-route">${n.route}</div>
                <div class="notif-detail">${n.detail}</div>
            </div>
            <span class="notif-time">${_timeLabel(n.time)}</span>
        </div>
    `).join('');

    if (count) count.textContent = `${_activityLog.length} evento${_activityLog.length !== 1 ? 's' : ''}`;
}

function renderRouteStatusList() {
    const container = document.getElementById('route-status-list');
    if (!container) return;

    const routes = DB.getRoutes();
    container.innerHTML = routes.map(r => {
        const pct      = Math.round((r.current / r.max) * 100);
        const fillCls  = pct >= 90 ? 'high' : pct >= 60 ? 'med' : '';
        const isFull   = r.current >= r.max;
        return `
            <a class="route-status-item" href="#caravanas">
                <span class="route-status-name">${r.name.replace('Entrada U → ', '')}</span>
                <div class="route-status-bar-wrap">
                    <div class="route-status-bar">
                        <div class="route-status-fill ${fillCls}" style="width:${pct}%;"></div>
                    </div>
                    <span class="route-status-pct">${isFull ? '🔒' : pct + '%'}</span>
                </div>
                <span class="route-status-time">⏱ ${r.time} · ${r.current}/${r.max} personas</span>
            </a>
        `;
    }).join('');
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
