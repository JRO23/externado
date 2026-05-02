/* ============================================
   DATA.JS — Capa de datos híbrida
   Supabase para reportes y solicitudes,
   localStorage como caché y fallback para rutas.
   ============================================ */

const DB = {

    /* ---------- REPORTES ---------- */
    async getReports() {
        try {
            const { data, error } = await supabase
                .from('reports')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(30);
            if (error) throw error;
            return data.map(r => ({
                id:       r.id,
                type:     r.type,
                location: r.location,
                desc:     r.description,
                time:     new Date(r.created_at).getTime(),
                user:     r.user_email || 'Anónimo',
            }));
        } catch {
            return this._seedReports();
        }
    },

    _seedReports() {
        var now = Date.now();
        var m   = 60 * 1000;
        return [
            {
                id: 1, type: 'Persona Sospechosa',
                location: 'Calle 12 con Carrera 4ta',
                desc: 'Dos hombres con capucha merodeando la esquina, siguen a estudiantes que salen de la U.',
                time: now - 4*m, user: 'Anónimo'
            },
            {
                id: 2, type: 'Zona Oscura',
                location: 'Chorro de Quevedo',
                desc: 'La luminaria del callejón sigue fundida. Tramo muy oscuro entre las 6 y 7 pm. Eviten ir solos.',
                time: now - 18*m, user: 'Anónimo'
            },
            {
                id: 3, type: 'Presencia Policial',
                location: 'Estación Las Aguas',
                desc: 'Patrulla de la Policía Metropolitana estacionada frente a la estación. Zona despejada.',
                time: now - 31*m, user: 'Anónimo'
            },
            {
                id: 4, type: 'Robo',
                location: 'Carrera 4 con Calle 11',
                desc: 'Raponazo de celular. El sujeto huyó hacia La Candelaria en moto. Mucho cuidado en ese tramo.',
                time: now - 47*m, user: 'Anónimo'
            },
            {
                id: 5, type: 'Persona Sospechosa',
                location: 'Av. Jiménez con Carrera 6',
                desc: 'Grupo de 3 personas en actitud sospechosa frente al CAI. Atentos si pasan por ahí.',
                time: now - 65*m, user: 'Anónimo'
            },
            {
                id: 6, type: 'Zona Oscura',
                location: 'Calle 11 entre Carreras 2 y 3',
                desc: 'El andén está completamente oscuro. Varias luminarias dañadas en ese tramo de La Candelaria.',
                time: now - 90*m, user: 'Anónimo'
            },
            {
                id: 7, type: 'Presencia Policial',
                location: 'San Victorino — Plaza España',
                desc: 'Operativo ESMAD activo desde las 5 pm. Eviten la zona si van hacia allá por esa ruta.',
                time: now - 110*m, user: 'Anónimo'
            },
            {
                id: 8, type: 'Robo',
                location: 'Carrera 6 con Calle 13',
                desc: 'Intentaron robar la maleta a una estudiante. Pidan acompañamiento si salen tarde por esta zona.',
                time: now - 140*m, user: 'Anónimo'
            },
            {
                id: 9, type: 'Persona Sospechosa',
                location: 'Parqueadero Calle 12',
                desc: 'Hombre revisando los vehículos estacionados. Avisaron a seguridad de la U.',
                time: now - 175*m, user: 'Anónimo'
            },
            {
                id: 10, type: 'Otro',
                location: 'Puerta Principal Externado',
                desc: 'Vendedor ambulante bloqueando la salida principal. Dificulta la visibilidad al salir. Tengan cuidado.',
                time: now - 200*m, user: 'Anónimo'
            },
        ];
    },

    async addReport(report) {
        const user = Auth.currentUser();
        const payload = {
            type:        report.type,
            location:    report.location,
            description: report.desc,
            user_email:  user ? user.email : 'Anónimo',
            user_id:     user ? user.id : null,
        };
        const { data, error } = await supabase.from('reports').insert(payload).select().single();
        if (error) {
            console.warn('Error guardando reporte:', error.message);
            return { ...report, id: Date.now(), time: Date.now() };
        }
        return { id: data.id, type: data.type, location: data.location, desc: data.description, time: new Date(data.created_at).getTime(), user: data.user_email };
    },

    async deleteReport(id) {
        const { error } = await supabase.from('reports').delete().eq('id', id);
        if (error) console.warn('Error eliminando reporte:', error.message);
    },

    /* ---------- SOLICITUDES ---------- */
    async getRequests() {
        try {
            const { data, error } = await supabase
                .from('requests')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data.map(r => ({
                id:        r.id,
                name:      r.name,
                origin:    r.origin,
                dest:      r.destination,
                time:      r.time,
                people:    r.people,
                notes:     r.notes,
                status:    r.status,
                userEmail: r.user_email,
                createdAt: new Date(r.created_at).getTime(),
            }));
        } catch {
            return JSON.parse(localStorage.getItem('em_requests') || '[]');
        }
    },

    async getRequestsByUser(email) {
        try {
            const { data, error } = await supabase
                .from('requests')
                .select('*')
                .eq('user_email', email)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data.map(r => ({
                id:        r.id,
                name:      r.name,
                origin:    r.origin,
                dest:      r.destination,
                time:      r.time,
                people:    r.people,
                notes:     r.notes,
                status:    r.status,
                userEmail: r.user_email,
                createdAt: new Date(r.created_at).getTime(),
            }));
        } catch {
            return JSON.parse(localStorage.getItem('em_requests') || '[]')
                .filter(r => r.userEmail === email);
        }
    },

    async addRequest(req) {
        const user = Auth.currentUser();
        const payload = {
            user_id:     user ? user.id   : null,
            user_email:  user ? user.email : req.userEmail,
            name:        req.name,
            origin:      req.origin,
            destination: req.dest,
            time:        req.time,
            people:      req.people,
            notes:       req.notes,
            status:      'pending',
        };
        const { data, error } = await supabase.from('requests').insert(payload).select().single();
        if (error) {
            console.warn('Error guardando solicitud:', error.message);
            // Fallback a localStorage
            const cached = JSON.parse(localStorage.getItem('em_requests') || '[]');
            const newReq = { ...req, id: Date.now(), status: 'pending', createdAt: Date.now() };
            cached.unshift(newReq);
            localStorage.setItem('em_requests', JSON.stringify(cached));
            return newReq;
        }
        return {
            id:        data.id,
            origin:    data.origin,
            dest:      data.destination,
            time:      data.time,
            people:    data.people,
            status:    data.status,
            userEmail: data.user_email,
            createdAt: new Date(data.created_at).getTime(),
        };
    },

    async updateRequestStatus(id, status) {
        const { error } = await supabase
            .from('requests')
            .update({ status })
            .eq('id', id);
        if (error) console.warn('Error actualizando estado:', error.message);
    },

    /* ---------- USUARIOS (solo admin) ---------- */
    async getUsers() {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('joined_at', { ascending: false });
            if (error) throw error;
            return data;
        } catch {
            return [];
        }
    },

    /* ---------- RUTAS (siguen en localStorage) ---------- */
    getRoutes() {
        // Limpiar caché vieja para mostrar las rutas actualizadas
        localStorage.removeItem('em_routes');
        const defaults = [
            {
                id: 1,
                name: 'Entrada U → Estación Las Aguas',
                station: 'ESTACIÓN LAS AGUAS',
                desc: 'Por Carrera 4 hasta Calle 10. Ruta iluminada con presencia policial.',
                time: '01:15 PM', duration: '8 min caminando',
                current: 9, max: 15,
                color: '#FFC107', textColor: '#3E2723'
            },
            {
                id: 2,
                name: 'Entrada U → Av. Jiménez',
                station: 'AV. JIMÉNEZ',
                desc: 'Por Calle 12 hacia el occidente. Parada SITP frente al Banco de la República.',
                time: '02:00 PM', duration: '10 min caminando',
                current: 5, max: 10,
                color: '#FFA000', textColor: '#fff'
            },
            {
                id: 3,
                name: 'Entrada U → San Victorino',
                station: 'SAN VICTORINO',
                desc: 'Por Calle 13. Mayor vigilancia en el recorrido. Recomendada en grupo.',
                time: '05:30 PM', duration: '18 min caminando',
                current: 12, max: 20,
                color: '#3E2723', textColor: '#fff'
            },
            {
                id: 4,
                name: 'Entrada U → La Candelaria',
                station: 'LA CANDELARIA',
                desc: 'Por Carrera 2. Zona histórica. Evitar después de las 7 pm.',
                time: '03:45 PM', duration: '12 min caminando',
                current: 3, max: 12,
                color: '#D32F2F', textColor: '#fff'
            },
            {
                id: 5,
                name: 'Entrada U → Portal El Dorado',
                station: 'PORTAL EL DORADO',
                desc: 'Hasta Las Aguas y luego TransMilenio directo hacia el occidente.',
                time: '06:00 PM', duration: '25 min en TM',
                current: 7, max: 18,
                color: '#1976D2', textColor: '#fff'
            },
            {
                id: 6,
                name: 'Entrada U → Chapinero',
                station: 'CHAPINERO',
                desc: 'TransMilenio desde Las Aguas hacia el norte. Ruta nocturna con acompañamiento.',
                time: '07:30 PM', duration: '20 min en TM',
                current: 4, max: 14,
                color: '#388E3C', textColor: '#fff'
            },
        ];
        this.saveRoutes(defaults);
        return defaults;
    },
    saveRoutes(routes) { localStorage.setItem('em_routes', JSON.stringify(routes)); },
    joinRoute(id) {
        const routes = this.getRoutes();
        const route  = routes.find(r => r.id === id);
        if (route && route.current < route.max) { route.current++; this.saveRoutes(routes); return true; }
        return false;
    },

    /* ---------- HELPERS ---------- */
    timeAgo(ts) {
        const diff = Math.floor((Date.now() - ts) / 1000);
        if (diff < 60)    return 'AHORA MISMO';
        if (diff < 3600)  return `HACE ${Math.floor(diff / 60)} MIN`;
        if (diff < 86400) return `HACE ${Math.floor(diff / 3600)} H`;
        return `HACE ${Math.floor(diff / 86400)} DÍAS`;
    },
    reportClass(type) {
        return { 'Zona Oscura': 'zone', 'Presencia Policial': 'police', 'Robo': 'robbery' }[type] || '';
    },
};
