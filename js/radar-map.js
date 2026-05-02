/* ============================================
   RADAR-MAP.JS — Mapa Leaflet + OpenStreetMap
   Universidad Externado de Colombia — Bogotá
   ============================================ */

const RadarMap = (() => {

    // ── Coordenadas clave (verificadas con OSM/Wikipedia) ─────────
    const EXTERNADO    = [4.5958,  -74.0684]; // Universidad Externado — Calle 12 #1-17 Este
    const LAS_AGUAS    = [4.6025,  -74.0684]; // Estación TransMilenio Las Aguas
    const UNIVERSIDADES= [4.6054,  -74.0669]; // Estación TransMilenio Universidades — Cra 3 con Cl 19
    const SAN_VIC      = [4.6010,  -74.0773]; // Estación TransMilenio San Victorino — Av. Cra 10
    const AV_JIM       = [4.6028,  -74.0797]; // Estación TransMilenio Av. Jiménez — Av. Caracas
    const CANDELARIA   = [4.5917,  -74.0741]; // Barrio La Candelaria (centro histórico)

    let map          = null;
    let incidentLayer = null;

    // ── Iconos personalizados ──────────────────────────────────────
    function makeIcon(color, emoji, size) {
        size = size || 36;
        return L.divIcon({
            className: '',
            html:
                '<div style="' +
                    'width:' + size + 'px;height:' + size + 'px;' +
                    'background:' + color + ';' +
                    'border-radius:50%;' +
                    'border:3px solid #fff;' +
                    'box-shadow:0 3px 12px rgba(0,0,0,0.35);' +
                    'display:flex;align-items:center;justify-content:center;' +
                    'font-size:' + Math.round(size * 0.45) + 'px;' +
                    'position:relative;' +
                '">' +
                    emoji +
                    '<div style="' +
                        'position:absolute;bottom:-8px;left:50%;' +
                        'transform:translateX(-50%);' +
                        'width:0;height:0;' +
                        'border-left:6px solid transparent;' +
                        'border-right:6px solid transparent;' +
                        'border-top:8px solid ' + color + ';' +
                    '"></div>' +
                '</div>',
            iconSize:    [size, size + 8],
            iconAnchor:  [Math.round(size / 2), size + 8],
            popupAnchor: [0, -(size + 10)],
        });
    }

    function makeAlertIcon(type) {
        var cfg = {
            'Persona Sospechosa': { color: '#FF9800', emoji: '&#128100;' },
            'Zona Oscura':        { color: '#5C6BC0', emoji: '&#127761;' },
            'Robo':               { color: '#D32F2F', emoji: '&#128682;' },
            'Presencia Policial': { color: '#4CAF50', emoji: '&#128659;' },
            'Otro':               { color: '#FF5722', emoji: '&#9888;'   },
        };
        var c = cfg[type] || { color: '#FF9800', emoji: '&#9888;' };
        return makeIcon(c.color, c.emoji, 38);
    }

    // ── Popup de incidente ─────────────────────────────────────────
    function buildPopup(r) {
        var colors = {
            'Persona Sospechosa': '#FF9800',
            'Zona Oscura':        '#5C6BC0',
            'Robo':               '#D32F2F',
            'Presencia Policial': '#4CAF50',
            'Otro':               '#FF5722',
        };
        var color   = colors[r.type] || '#FF9800';
        var timeStr = (typeof DB !== 'undefined') ? DB.timeAgo(r.time) : 'Reciente';
        return (
            '<div style="font-family:Inter,sans-serif;min-width:200px;max-width:260px;">' +
                '<div style="background:' + color + ';color:#fff;padding:8px 12px;' +
                    'margin:-14px -20px 10px -20px;border-radius:8px 8px 0 0;' +
                    'font-weight:800;font-size:0.8rem;text-transform:uppercase;">' +
                    r.type +
                '</div>' +
                '<div style="font-size:0.82rem;font-weight:700;color:#3E2723;margin-bottom:4px;">' +
                    '&#128205; ' + r.location +
                '</div>' +
                '<div style="font-size:0.78rem;color:#6D4C41;line-height:1.5;margin-bottom:8px;">' +
                    '"' + r.desc + '"' +
                '</div>' +
                '<div style="font-size:0.7rem;color:#9E9E9E;font-weight:700;text-align:right;">' +
                    '&#128336; ' + timeStr +
                '</div>' +
            '</div>'
        );
    }

    // ── Geocodificación aproximada ─────────────────────────────────
    var LOCATION_HINTS = [
        // Estaciones TransMilenio
        { keys: ['aguas', 'las aguas'],                        lat: 4.6025,  lng: -74.0684 },
        { keys: ['universidades', 'est. universidades'],       lat: 4.6054,  lng: -74.0669 },
        { keys: ['jiménez', 'jimenez', 'av jim', 'av. jim'],  lat: 4.6028,  lng: -74.0797 },
        { keys: ['victorino', 'san victorino'],                lat: 4.6010,  lng: -74.0773 },
        // Barrios y sectores
        { keys: ['candelaria', 'la candelaria'],               lat: 4.5917,  lng: -74.0741 },
        { keys: ['chorro', 'quevedo'],                         lat: 4.5992,  lng: -74.0756 },
        // Vías cercanas a la U
        { keys: ['calle 12', 'cl 12'],                         lat: 4.5960,  lng: -74.0690 },
        { keys: ['calle 11', 'cl 11'],                         lat: 4.5948,  lng: -74.0690 },
        { keys: ['carrera 4', 'kr 4', 'cra 4'],               lat: 4.5970,  lng: -74.0670 },
        { keys: ['carrera 6', 'kr 6', 'cra 6'],               lat: 4.5970,  lng: -74.0710 },
        // Entrada universidad
        { keys: ['entrada', 'puerta principal', 'externado'],  lat: 4.5958,  lng: -74.0684 },
        { keys: ['parking', 'parqueadero'],                    lat: 4.5962,  lng: -74.0688 },
        // Plaza España / San Victorino (comercial)
        { keys: ['plaza españa', 'plaza espana', 'españa'],    lat: 4.6003,  lng: -74.0801 },
    ];

    function guessCoords(locationText) {
        var text = (locationText || '').toLowerCase();
        for (var i = 0; i < LOCATION_HINTS.length; i++) {
            var hint = LOCATION_HINTS[i];
            for (var j = 0; j < hint.keys.length; j++) {
                if (text.indexOf(hint.keys[j]) !== -1) {
                    return [
                        hint.lat + (Math.random() - 0.5) * 0.0004,
                        hint.lng + (Math.random() - 0.5) * 0.0004,
                    ];
                }
            }
        }
        return [
            EXTERNADO[0] + (Math.random() - 0.5) * 0.012,
            EXTERNADO[1] + (Math.random() - 0.5) * 0.012,
        ];
    }

    // ── Inicializar mapa ───────────────────────────────────────────
    function init() {
        if (map) return; // ya inicializado

        var container = document.getElementById('map-container');
        if (!container) {
            console.warn('RadarMap: #map-container no encontrado');
            return;
        }

        // Verificar que Leaflet esté disponible
        if (typeof L === 'undefined') {
            console.warn('RadarMap: Leaflet (L) no está disponible aún');
            return;
        }

        try {
            map = L.map('map-container', {
                center: EXTERNADO,
                zoom: 15,
                zoomControl: true,
                scrollWheelZoom: false,
                attributionControl: true,
            });

            // Tiles — OpenStreetMap (libre, sin restricciones de dominio)
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                subdomains: 'abc',
                maxZoom: 19,
            }).addTo(map);

            // ── Marcadores fijos ───────────────────────────────────

            // ── Universidad Externado (marcador principal) ─────────
            L.marker(EXTERNADO, { icon: makeIcon('#4CAF50', '&#127963;', 42), zIndexOffset: 1000 })
                .addTo(map)
                .bindPopup(
                    '<div style="font-family:Inter,sans-serif;font-weight:800;color:#3E2723;font-size:0.85rem;">' +
                    '&#127963; UNIVERSIDAD EXTERNADO DE COLOMBIA<br>' +
                    '<span style="font-weight:400;font-size:0.78rem;color:#6D4C41;">Puerta Principal &mdash; Calle 12 #1-17 Este, La Candelaria</span>' +
                    '</div>',
                    { maxWidth: 240 }
                );

            // ── Estaciones TransMilenio ────────────────────────────
            L.marker(LAS_AGUAS, { icon: makeIcon('#1976D2', '&#128647;', 36) })
                .addTo(map)
                .bindPopup(
                    '<b style="font-family:Inter,sans-serif;">&#128647; Estación Las Aguas</b><br>' +
                    '<small>TransMilenio &mdash; Troncal Caracas &mdash; Cra 3 con Cl 13</small>'
                );

            L.marker(UNIVERSIDADES, { icon: makeIcon('#0288D1', '&#127979;', 36) })
                .addTo(map)
                .bindPopup(
                    '<b style="font-family:Inter,sans-serif;">&#127979; Estación Universidades</b><br>' +
                    '<small>TransMilenio &mdash; Troncal Caracas &mdash; Cra 3 con Cl 19-22</small>'
                );

            L.marker(SAN_VIC, { icon: makeIcon('#6D4C41', '&#128722;', 34) })
                .addTo(map)
                .bindPopup(
                    '<b style="font-family:Inter,sans-serif;">&#128647; Estación San Victorino</b><br>' +
                    '<small>TransMilenio &mdash; Troncal Caracas &mdash; Av. Cra 10 con Cl 11-13</small>'
                );

            L.marker(AV_JIM, { icon: makeIcon('#FFA000', '&#128652;', 34) })
                .addTo(map)
                .bindPopup(
                    '<b style="font-family:Inter,sans-serif;">&#128652; Estación Av. Jiménez</b><br>' +
                    '<small>TransMilenio &mdash; Intercambiador Caracas/Américas &mdash; Av. Caracas con Cl 13</small>'
                );

            // ── Barrio La Candelaria ───────────────────────────────
            L.marker(CANDELARIA, { icon: makeIcon('#5C6BC0', '&#9962;', 34) })
                .addTo(map)
                .bindPopup(
                    '<b style="font-family:Inter,sans-serif;">&#9962; La Candelaria</b><br>' +
                    '<small>Centro histórico de Bogotá &mdash; Mayor vigilancia nocturna</small>'
                );

            // Capa de incidentes
            incidentLayer = L.layerGroup().addTo(map);

            // Radio zona monitoreada (~800m alrededor de la U)
            L.circle(EXTERNADO, {
                radius: 800,
                color: '#FFC107',
                fillColor: '#FFC107',
                fillOpacity: 0.05,
                weight: 1.5,
                dashArray: '6 4',
            }).addTo(map);

            // CLAVE: forzar que Leaflet recalcule el tamaño del contenedor
            setTimeout(function() {
                map.invalidateSize();
            }, 200);

            console.log('RadarMap: mapa inicializado correctamente');

        } catch (err) {
            console.error('RadarMap: error al inicializar', err);
        }
    }

    // ── Cargar incidentes de Supabase ──────────────────────────────
    async function loadIncidents() {
        if (!map || !incidentLayer) return;
        incidentLayer.clearLayers();

        try {
            var reports = await DB.getReports();
            reports.forEach(function(r) {
                var coords = guessCoords(r.location);
                L.marker(coords, { icon: makeAlertIcon(r.type) })
                    .bindPopup(buildPopup(r), { maxWidth: 280 })
                    .addTo(incidentLayer);

                if (r.type !== 'Presencia Policial') {
                    var pulse = L.circle(coords, {
                        radius: 45,
                        color: '#FF9800',
                        fillColor: '#FF9800',
                        fillOpacity: 0.15,
                        weight: 2,
                    }).addTo(incidentLayer);
                    setTimeout(function() { incidentLayer.removeLayer(pulse); }, 12000);
                }
            });
        } catch(e) {
            console.warn('RadarMap: no se pudieron cargar incidentes', e);
        }
    }

    // ── Alerta en tiempo real (al reportar) ────────────────────────
    function addLiveAlert(report) {
        if (!map || !incidentLayer) return;

        var coords = guessCoords(report.location || '');

        L.marker(coords, { icon: makeAlertIcon(report.type), zIndexOffset: 500 })
            .addTo(incidentLayer)
            .bindPopup(buildPopup(report), { maxWidth: 280 })
            .openPopup();

        var pulse = L.circle(coords, {
            radius: 70,
            color: '#D32F2F',
            fillColor: '#D32F2F',
            fillOpacity: 0.2,
            weight: 2.5,
        }).addTo(incidentLayer);

        map.flyTo(coords, 16, { animate: true, duration: 1.2 });
        setTimeout(function() { incidentLayer.removeLayer(pulse); }, 15000);
    }

    return { init: init, loadIncidents: loadIncidents, addLiveAlert: addLiveAlert };

})();

// ── Inicializar cuando el script se ejecuta ────────────────────────
// (los scripts al final del <body> se ejecutan con el DOM ya listo)
window.addEventListener('load', function() {
    RadarMap.init();
});
