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
        return [
            { id: 1, type: 'Persona Sospechosa', location: 'Calle 12 con Carrera 4ta', desc: 'Hombre con chaqueta oscura merodeando en la esquina.', time: Date.now() - 5*60*1000, user: 'Comunidad' },
            { id: 2, type: 'Zona Oscura', location: 'Chorro de Quevedo', desc: 'Luminaria fundida. Eviten pasar solos de noche.', time: Date.now() - 20*60*1000, user: 'Comunidad' },
            { id: 3, type: 'Presencia Policial', location: 'Estación Las Aguas', desc: 'Patrulla motorizada estacionada frente a la estación.', time: Date.now() - 32*60*1000, user: 'Comunidad' },
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
        const stored = localStorage.getItem('em_routes');
        if (stored) return JSON.parse(stored);
        const defaults = [
            { id: 1, name: 'Entrada U → Las Aguas',     station: 'ESTACIÓN LAS AGUAS', time: '01:15 PM', current: 9,  max: 15, color: '#FFC107', textColor: '#3E2723' },
            { id: 2, name: 'Entrada U → Av. Jiménez',   station: 'AV. JIMÉNEZ',         time: '02:00 PM', current: 5,  max: 10, color: '#FFA000', textColor: '#fff' },
            { id: 3, name: 'Entrada U → San Victorino', station: 'SAN VICTORINO',        time: '05:30 PM', current: 12, max: 20, color: '#3E2723', textColor: '#fff' },
            { id: 4, name: 'Entrada U → La Candelaria', station: 'LA CANDELARIA',        time: '03:45 PM', current: 3,  max: 12, color: '#D32F2F', textColor: '#fff' },
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
