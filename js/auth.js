/* ============================================
   AUTH.JS — Session management
   ============================================ */

const Auth = {

    SESSION_KEY: 'em_session',

    getSession() {
        try {
            return JSON.parse(sessionStorage.getItem(this.SESSION_KEY));
        } catch { return null; }
    },

    setSession(user) {
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(user));
    },

    clearSession() {
        sessionStorage.removeItem(this.SESSION_KEY);
    },

    isLoggedIn() {
        return !!this.getSession();
    },

    currentUser() {
        return this.getSession();
    },

    isAdmin() {
        const u = this.getSession();
        return u && u.role === 'admin';
    },

    register(name, lastname, email, password, role) {
        email = email.toLowerCase().trim();
        if (DB.findUserByEmail(email)) {
            return { ok: false, msg: 'Este correo ya está registrado.' };
        }
        if (password.length < 6) {
            return { ok: false, msg: 'La contraseña debe tener al menos 6 caracteres.' };
        }
        const user = {
            id: Date.now(),
            name: name.trim(),
            lastname: lastname.trim(),
            email,
            // In production you'd hash server-side; this is demo only
            passwordHash: btoa(password),
            role: role || 'student',
            joinedAt: Date.now(),
        };
        DB.addUser(user);
        this.setSession(user);
        return { ok: true, user };
    },

    login(email, password) {
        email = email.toLowerCase().trim();
        const user = DB.findUserByEmail(email);
        if (!user) return { ok: false, msg: 'Correo no registrado.' };
        if (user.passwordHash !== btoa(password)) return { ok: false, msg: 'Contraseña incorrecta.' };
        this.setSession(user);
        return { ok: true, user };
    },

    logout() {
        this.clearSession();
        window.location.href = 'index.html';
    },

    // Seed admin account if not exists
    seedAdmin() {
        if (!DB.findUserByEmail('admin@externado.edu.co')) {
            DB.addUser({
                id: 1,
                name: 'Admin',
                lastname: 'Move',
                email: 'admin@externado.edu.co',
                passwordHash: btoa('admin123'),
                role: 'admin',
                joinedAt: Date.now(),
            });
        }
    }
};

// Seed admin on load
Auth.seedAdmin();

/* ============================================
   AUTH UI FUNCTIONS (shared across pages)
   ============================================ */

function openAuthModal() {
    document.getElementById('auth-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeAuthModal() {
    document.getElementById('auth-modal').style.display = 'none';
    document.body.style.overflow = '';
}

function switchTab(tab) {
    const isLogin = tab === 'login';
    document.getElementById('tab-login').classList.toggle('active', isLogin);
    document.getElementById('tab-register').classList.toggle('active', !isLogin);
    document.getElementById('form-login').style.display = isLogin ? 'flex' : 'none';
    document.getElementById('form-register').style.display = isLogin ? 'none' : 'flex';
    document.getElementById('login-error').style.display = 'none';
    document.getElementById('reg-error').style.display = 'none';
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass  = document.getElementById('login-pass').value;
    const result = Auth.login(email, pass);
    if (!result.ok) {
        const err = document.getElementById('login-error');
        err.textContent = result.msg;
        err.style.display = 'block';
        return;
    }
    closeAuthModal();
    updateNavAuth();
    showNotification('¡Bienvenido!', `Hola ${result.user.name} 👋`, 'success');
    if (typeof onLoginSuccess === 'function') onLoginSuccess(result.user);
}

function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const last = document.getElementById('reg-lastname').value;
    const email = document.getElementById('reg-email').value;
    const pass  = document.getElementById('reg-pass').value;
    const role  = document.getElementById('reg-role').value;
    const result = Auth.register(name, last, email, pass, role);
    if (!result.ok) {
        const err = document.getElementById('reg-error');
        err.textContent = result.msg;
        err.style.display = 'block';
        return;
    }
    closeAuthModal();
    updateNavAuth();
    showNotification('¡Registro exitoso!', `Bienvenido a Externado Move, ${name}!`, 'success');
    if (typeof onLoginSuccess === 'function') onLoginSuccess(result.user);
}

function updateNavAuth() {
    const zone = document.getElementById('nav-auth-zone');
    if (!zone) return;
    const user = Auth.currentUser();
    if (!user) {
        zone.innerHTML = `<button class="btn-login-nav" onclick="openAuthModal()">Ingresar</button>`;
        return;
    }
    const initials = (user.name[0] + (user.lastname[0] || '')).toUpperCase();
    zone.innerHTML = `
        <div class="nav-user" id="nav-user-btn" onclick="toggleUserMenu()">
            <div class="nav-avatar">${initials}</div>
            <span class="nav-user-name">${user.name}</span>
            <span style="font-size:0.6rem;opacity:0.5;">▼</span>
            <div class="nav-user-menu" id="user-menu">
                <a href="dashboard.html">👤 Mi Panel</a>
                ${user.role === 'admin' ? '<a href="admin.html">🛡️ Admin</a>' : ''}
                <div class="menu-divider"></div>
                <button onclick="Auth.logout()">🚪 Cerrar sesión</button>
            </div>
        </div>`;
}

function toggleUserMenu() {
    const menu = document.getElementById('user-menu');
    if (menu) menu.classList.toggle('open');
}

// Close menu when clicking outside
document.addEventListener('click', (e) => {
    const userBtn = document.getElementById('nav-user-btn');
    const menu = document.getElementById('user-menu');
    if (menu && userBtn && !userBtn.contains(e.target)) {
        menu.classList.remove('open');
    }
});

function toggleMobileMenu() {
    document.getElementById('mobile-menu').classList.toggle('open');
}

function closeMobileMenu() {
    document.getElementById('mobile-menu').classList.remove('open');
}

/* ============================================
   NOTIFICATION (TOAST) — shared
   ============================================ */
function showNotification(title, msg, type = 'default') {
    const host = document.getElementById('notification-host');
    if (!host) return;
    const toast = document.createElement('div');
    const typeClass = type !== 'default' ? type : '';
    toast.className = `toast ${typeClass}`;
    toast.innerHTML = `<div class="toast-title ${typeClass}">${title}</div><div class="toast-msg">${msg}</div>`;
    host.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 80);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 450);
    }, 3500);
}
