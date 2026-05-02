/* ============================================
   RADAR-MAP.JS — Mapa Leaflet + OpenStreetMap
   Universidad Externado de Colombia — Bogotá
   ============================================ */

const RadarMap = (() => {

    // ── Coordenadas clave ──────────────────────────────────────────
    const EXTERNADO  = [4.60155, -74.06635]; // Entrada principal U
    const LAS_AGUAS  = [4.60055, -74.06355]; // Estación Las Aguas
    const SAN_VIC    = [4.59575, -74.07235]; // San Victorino
    const AV_JIM     = [4.60285, -74.07105]; // Av. Jiménez
    const CANDELARIA = [4.59845, -74.07545]; // La Candelaria

    let map = null;
    let incidentLayer = null;  // LayerGroup para marcadores dinámicos

    // ── Iconos personalizados ──────────────────────────────────────
    function makeIcon(color, emoji, size = 36) {
        return L.divIcon({
            className: '',
            html: `
                <div style="
                    width:${size}px; height:${size}px;
                    background:${color};
                    border-radius:50%;
                    border:3px solid #fff;
                    box-shadow:0 3px 12px rgba(0,0,0,0.35);
                    display:flex; align-items:center; justify-content:center;
                    font-size:${size * 0.45}px;
                    position:relative;
                ">
                    ${emoji}
                    <div style="
                        position:absolute; bottom:-8px; left:50%;
                        transform:translateX(-50%);
                        width:0; height:0;
                        border-left:6px solid transparent;
                        border-right:6px solid transparent;
                        border-top:8px solid ${color};
                    "></div>
                </div>`,
            iconSize:   [size, size + 8],
            iconAnchor: [size / 2, size + 8],
            popupAnchor:[0, -(size + 10)],
        });
    }

    function makeAlertIcon(type) {
        const cfg = {
            'Persona Sospechosa': { color: '#FF9800', emoji: '👤' },
            'Zona Oscura':        { color: '#5C6BC0', emoji: '🌑' },
            'Robo':               { color: '#D32F2F', emoji: '🔪' },
            'Presencia Policial': { color: '#4CAF50', emoji: '🚓' },
            'Otro':               { color: '#FF5722', emoji: '⚠️' },
        };
        const { color, emoji } = cfg[type] || { color: '#FF9800', emoji: '⚠️' };
        return makeIcon(color, emoji, 38);
    }

    // ── Popup de incidente ─────────────────────────────────────────
    function buildPopup(r) {
        const typeCfg = {
            'Persona Sospechosa': '#FF9800',
            'Zona Oscura':        '#5C6BC0',
            'Robo':               '#D32F2F',
            'Presencia Policial': '#4CAF50',
            'Otro':               '#FF5722',
        };
        const color = typeCfg[r.type] || '#FF9800';
        const timeStr = typeof DB !== 'undefined' ? DB.timeAgo(r.time) : 'Reciente';
        return `
            <div style="font-family:'Inter',sans-serif; min-width:200px; max-width:260px;">
                <div style="
                    background:${color};
                    color:#fff;
                    padding:8px 12px;
                    margin:-14px -20px 10px -20px;
                    border-radius:8px 8px 0 0;
                    font-weight:800;
                    font-size:0.8rem;
                    letter-spacing:0.5px;
                    text-transform:uppercase;
                ">${r.type}</div>
                <div style="font-size:0.82rem; font-weight:700; color:#3E2723; margin-bottom:4px;">
                    📍 ${r.location}
                </div>
                <div style="font-size:0.78rem; color:#6D4C41; line-height:1.5; margin-bottom:8px;">
                    "${r.desc}"
                </div>
                <div style="font-size:0.7rem; color:#9E9E9E; font-weight:700; text-align:right;">
                    🕐 ${timeStr}
                </div>
            </div>`;
    }

    // ── Geocodificación aproximada por nombre de calle ─────────────
    // Mapea nombres comunes del sector a coordenadas reales
    const LOCATION_HINTS = [
        { keys: ['aguas', 'las aguas'],            lat: 4.60055, lng: -74.06355 },
        { keys: ['jiménez', 'jimenez', 'av jim'],  lat: 4.60285, lng: -74.07105 },
        { keys: ['victorino', 'san victorino'],     lat: 4.59575, lng: -74.07235 },
        { keys: ['candelaria', 'la candelaria'],    lat: 4.59845, lng: -74.07545 },
        { keys: ['chorro', 'quevedo'],              lat: 4.59988, lng: -74.07265 },
        { keys: ['calle 12', 'cl 12'],              lat: 4.59985, lng: -74.06700 },
        { keys: ['calle 11', 'cl 11'],              lat: 4.59840, lng: -74.06720 },
        { keys: ['carrera 4', 'kr 4', 'cra 4'],    lat: 4.60100, lng: -74.06500 },
        { keys: ['carrera 6', 'kr 6', 'cra 6'],    lat: 4.60100, lng: -74.07000 },
        { keys: ['entrada', 'puerta principal'],    lat: 4.60155, lng: -74.06635 },
        { keys: ['parking', 'parqueadero'],         lat: 4.60200, lng: -74.06700 },
    ];

    function guessCoords(locationText) {
        const text = locationText.toLowerCase();
        for (const hint of LOCATION_HINTS) {
            if (hint.keys.some(k => text.includes(k))) {
                // Pequeño offset aleatorio para no apilar marcadores exactos
                return [
                    hint.lat + (Math.random() - 0.5) * 0.0004,
                    hint.lng + (Math.random() - 0.5) * 0.0004,
                ];
            }
        }
        // Sin coincidencia: dispersar aleatoriamente cerca del Externado
        return [
            EXTERNADO[0] + (Math.random() - 0.5) * 0.012,
            EXTERNADO[1] + (Math.random() - 0.5) * 0.012,
        ];
    }

    // ── Inicializar mapa ───────────────────────────────────────────
    function init() {
        const container = document.getElementById('map-container');
        if (!container || map) return;

        // Estilo oscuro personalizado usando CartoDB Dark Matter
        map = L.map('map-container', {
            center: EXTERNADO,
            zoom: 15,
            zoomControl: true,
            scrollWheelZoom: false, // evita scroll accidental
            attributionControl: true,
        });

        // Tiles oscuros (estilo que combina con la marca)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_matter/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19,
        }).addTo(map);

        // ── Marcadores de puntos fijos ─────────────────────────────

        // Entrada principal
        L.marker(EXTERNADO, { icon: makeIcon('#4CAF50', '🏛️', 42), zIndexOffset: 1000 })
            .addTo(map)
            .bindPopup(`<div style="font-family:'Inter',sans-serif; font-weight:800; color:#3E2723; font-size:0.85rem;">
                🏛️ UNIVERSIDAD EXTERNADO<br>
                <span style="font-weight:400; font-size:0.78rem; color:#6D4C41;">Puerta Principal — Calle 12 # 1-17</span>
            </div>`, { maxWidth: 240 });

        // Estación Las Aguas
        L.marker(LAS_AGUAS, { icon: makeIcon('#1976D2', '🚇', 36) })
            .addTo(map)
            .bindPopup('<b style="font-family:Inter,sans-serif;">🚇 Estación Las Aguas</b><br><small>TransMilenio — Línea A</small>');

        // San Victorino
        L.marker(SAN_VIC, { icon: makeIcon('#6D4C41', '🛒', 34) })
            .addTo(map)
            .bindPopup('<b style="font-family:Inter,sans-serif;">🛒 San Victorino</b>');

        // Av. Jiménez
        L.marker(AV_JIM, { icon: makeIcon('#FFA000', '🚌', 34) })
            .addTo(map)
            .bindPopup('<b style="font-family:Inter,sans-serif;">🚌 Av. Jiménez</b><br><small>Parada SITP</small>');

        // La Candelaria
        L.marker(CANDELARIA, { icon: makeIcon('#5C6BC0', '⛪', 34) })
            .addTo(map)
            .bindPopup('<b style="font-family:Inter,sans-serif;">⛪ La Candelaria</b>');

        // ── Capa de incidentes (dinámica) ──────────────────────────
        incidentLayer = L.layerGroup().addTo(map);

        // Radio de zona monitoreada (visual)
        L.circle(EXTERNADO, {
            radius: 600,
            color: '#FFC107',
            fillColor: '#FFC107',
            fillOpacity: 0.04,
            weight: 1.5,
            dashArray: '6 4',
        }).addTo(map);
    }

    // ── Cargar incidentes de Supabase sobre el mapa ────────────────
    async function loadIncidents() {
        if (!map) return;
        incidentLayer.clearLayers();

        const reports = await DB.getReports();

        reports.forEach(r => {
            const coords = guessCoords(r.location);
            const icon   = makeAlertIcon(r.type);

            const marker = L.marker(coords, { icon })
                .bindPopup(buildPopup(r), { maxWidth: 280 })
                .addTo(incidentLayer);

            // Animación de pulso en alerta: añadir círculo pulsante
            if (r.type !== 'Presencia Policial') {
                const pulse = L.circle(coords, {
                    radius: 45,
                    color: '#FF9800',
                    fillColor: '#FF9800',
                    fillOpacity: 0.15,
                    weight: 2,
                }).addTo(incidentLayer);

                // Desvanece el círculo tras 12 segundos
                setTimeout(() => { incidentLayer.removeLayer(pulse); }, 12000);
            }
        });
    }

    // ── Añadir un marcador nuevo inmediatamente (al reportar) ──────
    function addLiveAlert(report) {
        if (!map || !incidentLayer) return;

        const coords = guessCoords(report.location || '');
        const icon   = makeAlertIcon(report.type);

        const marker = L.marker(coords, { icon, zIndexOffset: 500 })
            .addTo(incidentLayer)
            .bindPopup(buildPopup(report), { maxWidth: 280 })
            .openPopup();

        // Círculo pulsante rojo de alerta nueva
        const pulse = L.circle(coords, {
            radius: 70,
            color: '#D32F2F',
            fillColor: '#D32F2F',
            fillOpacity: 0.2,
            weight: 2.5,
        }).addTo(incidentLayer);

        // Centrar el mapa en la nueva alerta
        map.flyTo(coords, 16, { animate: true, duration: 1.2 });

        // Limpiar círculo pulsante tras 15 segundos
        setTimeout(() => { incidentLayer.removeLayer(pulse); }, 15000);
    }

    // ── API pública ────────────────────────────────────────────────
    return { init, loadIncidents, addLiveAlert };

})();

// ── Auto-inicializar cuando el DOM esté listo ──────────────────────
document.addEventListener('DOMContentLoaded', () => {
    RadarMap.init();
});
