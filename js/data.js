/* ============================================
   DATA.JS — Persistent mock data with localStorage
   ============================================ */

const DB = {

    /* ---------- USERS ---------- */
    getUsers() {
        return JSON.parse(localStorage.getItem('em_users') || '[]');
    },
    saveUsers(users) {
        localStorage.setItem('em_users', JSON.stringify(users));
    },
    findUserByEmail(email) {
        return this.getUsers().find(u => u.email === email.toLowerCase());
    },
    addUser(user) {
        const users = this.getUsers();
        users.push(user);
        this.saveUsers(users);
    },

    /* ---------- REPORTS ---------- */
    getReports() {
        const stored = localStorage.getItem('em_reports');
        if (stored) return JSON.parse(stored);
        // Default seed data
        const defaults = [
            { id: 1, type: 'Persona Sospechosa', location: 'Calle 12 con Carrera 4ta', desc: 'Hombre con chaqueta oscura merodeando en la esquina.', time: Date.now() - 5*60*1000, user: 'Comunidad' },
            { id: 2, type: 'Zona Oscura', location: 'Chorro de Quevedo', desc: 'Luminaria fundida. Eviten pasar solos de noche.', time: Date.now() - 20*60*1000, user: 'Comunidad' },
            { id: 3, type: 'Presencia Policial', location: 'Estación Las Aguas', desc: 'Patrulla motorizada estacionada frente a la estación.', time: Date.now() - 32*60*1000, user: 'Comunidad' },
        ];
        this.saveReports(defaults);
        return defaults;
    },
    saveReports(reports) {
        localStorage.setItem('em_reports', JSON.stringify(reports));
    },
    addReport(report) {
        const reports = this.getReports();
        report.id = Date.now();
        reports.unshift(report);
        this.saveReports(reports);
        return report;
    },

    /* ---------- REQUESTS (Accompaniment) ---------- */
    getRequests() {
        return JSON.parse(localStorage.getItem('em_requests') || '[]');
    },
    saveRequests(requests) {
        localStorage.setItem('em_requests', JSON.stringify(requests));
    },
    addRequest(req) {
        const requests = this.getRequests();
        req.id = Date.now();
        req.status = 'pending';
        req.createdAt = Date.now();
        requests.unshift(req);
        this.saveRequests(requests);
        return req;
    },
    updateRequestStatus(id, status) {
        const requests = this.getRequests();
        const idx = requests.findIndex(r => r.id === id);
        if (idx !== -1) { requests[idx].status = status; this.saveRequests(requests); }
    },
    getRequestsByUser(email) {
        return this.getRequests().filter(r => r.userEmail === email);
    },

    /* ---------- ROUTES ---------- */
    getRoutes() {
        const stored = localStorage.getItem('em_routes');
        if (stored) return JSON.parse(stored);
        const defaults = [
            { id: 1, name: 'Entrada U → Las Aguas', station: 'ESTACIÓN LAS AGUAS', time: '01:15 PM', current: 9, max: 15, color: '#FFC107', textColor: '#3E2723' },
            { id: 2, name: 'Entrada U → Av. Jiménez', station: 'AV. JIMÉNEZ', time: '02:00 PM', current: 5, max: 10, color: '#FFA000', textColor: '#fff' },
            { id: 3, name: 'Entrada U → San Victorino', station: 'SAN VICTORINO', time: '05:30 PM', current: 12, max: 20, color: '#3E2723', textColor: '#fff' },
            { id: 4, name: 'Entrada U → La Candelaria', station: 'LA CANDELARIA', time: '03:45 PM', current: 3, max: 12, color: '#D32F2F', textColor: '#fff' },
        ];
        this.saveRoutes(defaults);
        return defaults;
    },
    saveRoutes(routes) {
        localStorage.setItem('em_routes', JSON.stringify(routes));
    },
    joinRoute(id) {
        const routes = this.getRoutes();
        const route = routes.find(r => r.id === id);
        if (route && route.current < route.max) {
            route.current++;
            this.saveRoutes(routes);
            return true;
        }
        return false;
    },

    /* ---------- HELPERS ---------- */
    timeAgo(ts) {
        const diff = Math.floor((Date.now() - ts) / 1000);
        if (diff < 60) return 'AHORA MISMO';
        if (diff < 3600) return `HACE ${Math.floor(diff/60)} MIN`;
        if (diff < 86400) return `HACE ${Math.floor(diff/3600)} H`;
        return `HACE ${Math.floor(diff/86400)} DÍAS`;
    },

    reportClass(type) {
        const map = {
            'Zona Oscura': 'zone',
            'Presencia Policial': 'police',
            'Robo': 'robbery',
        };
        return map[type] || '';
    }
};
