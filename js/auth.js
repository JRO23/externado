/* ============================================
   AUTH.JS — Autenticación con Supabase Auth
   ============================================ */

const Auth = {

    /* ---------- SESIÓN ---------- */
    _session: null,
    _profile: null,

    // Obtener sesión activa de Supabase
    async getSession() {
        const { data } = await supabase.auth.getSession();
        this._session = data.session;
        return data.session;
    },

    // Obtener el perfil del usuario actual (tabla profiles)
    async getProfile(userId) {
        if (this._profile && this._profile.id === userId) return this._profile;
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        if (!error) this._profile = data;
        return data;
    },

    // Usuario actualmente en sesión (sincrónico, usa caché)
    currentUser() {
        return this._profile;
    },

    isLoggedIn() {
        return !!this._session;
    },

    isAdmin() {
        return this._profile && this._profile.role === 'admin';
    },

    /* ---------- REGISTRO ---------- */
    async register(name, lastname, email, password, role) {
        // 1. Crear usuario en Supabase Auth
        const { data, error } = await supabase.auth.signUp({
            email: email.trim().toLowerCase(),
            password,
            options: {
                data: { name, lastname, role }  // metadata
            }
        });

        if (error) {
            // Traducir errores comunes
            if (error.message.includes('already registered') || error.message.includes('already been registered')) {
                return { ok: false, msg: 'Este correo ya está registrado.' };
            }
            if (error.message.includes('Password') || error.message.includes('password')) {
                return { ok: false, msg: 'La contraseña debe tener al menos 6 caracteres.' };
            }
            if (error.message.includes('valid email')) {
                return { ok: false, msg: 'Por favor ingresa un correo válido.' };
            }
            return { ok: false, msg: error.message };
        }

        const user = data.user;
        if (!user) return { ok: false, msg: 'No se pudo crear el usuario. Intenta de nuevo.' };

        // 2. Verificar si necesita confirmación de email
        // Si la sesión es null, Supabase envió un correo de confirmación
        if (!data.session) {
            return {
                ok: true,
                needsConfirmation: true,
                msg: '¡Cuenta creada! Revisa tu correo y confirma tu email para poder iniciar sesión.',
                user: { name, lastname, email: email.trim().toLowerCase(), role: role || 'student' }
            };
        }

        // 3. Si hay sesión activa (autoconfirm enabled), guardar perfil
        const { error: profileError } = await supabase
            .from('profiles')
            .insert({
                id:       user.id,
                name:     name.trim(),
                lastname: lastname.trim(),
                email:    email.trim().toLowerCase(),
                role:     role || 'student',
            });

        if (profileError) {
            console.warn('Error guardando perfil:', profileError.message);
        }

        // 4. Cargar sesión y perfil en memoria
        this._session = data.session;
        this._profile = {
            id:       user.id,
            name:     name.trim(),
            lastname: lastname.trim(),
            email:    email.trim().toLowerCase(),
            role:     role || 'student',
            joinedAt: new Date().toISOString(),
        };

        localStorage.setItem('em_profile', JSON.stringify(this._profile));
        return { ok: true, user: this._profile };
    },

    /* ---------- LOGIN ---------- */
    async login(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password,
        });

        if (error) {
            if (error.message.includes('Invalid login') || error.message.includes('invalid_credentials')) {
                return { ok: false, msg: 'Correo o contraseña incorrectos.' };
            }
            return { ok: false, msg: error.message };
        }

        this._session = data.session;

        // Cargar perfil desde Supabase
        const profile = await this.getProfile(data.user.id);

        if (!profile) {
            // Si no existe perfil, crear uno básico desde metadata
            const meta = data.user.user_metadata || {};
            this._profile = {
                id:       data.user.id,
                name:     meta.name || 'Usuario',
                lastname: meta.lastname || '',
                email:    data.user.email,
                role:     meta.role || 'student',
                joinedAt: data.user.created_at,
            };
            // Insertar perfil faltante
            await supabase.from('profiles').upsert({
                id:       this._profile.id,
                name:     this._profile.name,
                lastname: this._profile.lastname,
                email:    this._profile.email,
                role:     this._profile.role,
            });
        } else {
            this._profile = profile;
        }

        localStorage.setItem('em_profile', JSON.stringify(this._profile));

        return { ok: true, user: this._profile };
    },

    /* ---------- LOGOUT ---------- */
    async logout() {
        await supabase.auth.signOut();
        this._session = null;
        this._profile = null;
        localStorage.removeItem('em_profile');
        window.location.href = 'index.html';
    },

    /* ---------- INICIALIZACIÓN ---------- */
    // Llamar al cargar cada página para restaurar sesión
    async init() {
        // 1. Mostrar botón ingresar de inmediato (sin esperar Supabase)
        updateNavAuth();

        // 2. Intentar restaurar desde caché mientras carga Supabase
        const cached = localStorage.getItem('em_profile');
        if (cached) {
            try {
                this._profile = JSON.parse(cached);
                updateNavAuth(); // actualizar con datos cacheados
            } catch {}
        }

        // 3. Verificar sesión real con Supabase
        const { data } = await supabase.auth.getSession();
        this._session = data.session;

        if (data.session) {
            const profile = await this.getProfile(data.session.user.id);
            if (profile) {
                this._profile = profile;
                localStorage.setItem('em_profile', JSON.stringify(profile));
            }
        } else {
            // No hay sesión activa — limpiar caché
            this._profile = null;
            this._session = null;
            localStorage.removeItem('em_profile');
        }

        // 4. Actualizar nav con estado real
        updateNavAuth();

        // 5. Escuchar cambios de sesión en tiempo real
        supabase.auth.onAuthStateChange(async (event, session) => {
            this._session = session;
            if (event === 'SIGNED_OUT') {
                this._profile = null;
                localStorage.removeItem('em_profile');
                updateNavAuth();
            }
            if (event === 'SIGNED_IN' && session) {
                const profile = await this.getProfile(session.user.id);
                if (profile) {
                    this._profile = profile;
                    localStorage.setItem('em_profile', JSON.stringify(profile));
                    updateNavAuth();
                }
            }
        });

        return this._profile;
    },

    /* ---------- ADMIN SEED ---------- */
    // No necesario con Supabase Auth — el admin se crea directamente
    // en Supabase Dashboard → Authentication → Users
    seedAdmin() { /* No-op: usar Supabase dashboard */ }
};

/* ============================================
   AUTH UI — Funciones compartidas entre páginas
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
    const loginErr = document.getElementById('login-error');
    const regErr   = document.getElementById('reg-error');
    if (loginErr) loginErr.style.display = 'none';
    if (regErr)   regErr.style.display   = 'none';
}

async function handleLogin(e) {
    e.preventDefault();
    const btn   = e.target.querySelector('button[type="submit"]');
    const email = document.getElementById('login-email').value;
    const pass  = document.getElementById('login-pass').value;
    const errEl = document.getElementById('login-error');

    btn.textContent = 'Ingresando...';
    btn.disabled = true;

    const result = await Auth.login(email, pass);

    btn.textContent = 'Entrar';
    btn.disabled = false;

    if (!result.ok) {
        errEl.textContent = result.msg;
        errEl.style.display = 'block';
        return;
    }

    closeAuthModal();
    updateNavAuth();
    showNotification('¡Bienvenido!', `Hola ${result.user.name} 👋`, 'success');
    if (typeof onLoginSuccess === 'function') onLoginSuccess(result.user);
}

async function handleRegister(e) {
    e.preventDefault();
    const btn      = e.target.querySelector('button[type="submit"]');
    const name     = document.getElementById('reg-name').value;
    const lastname = document.getElementById('reg-lastname').value;
    const email    = document.getElementById('reg-email').value;
    const pass     = document.getElementById('reg-pass').value;
    const role     = document.getElementById('reg-role').value;
    const errEl    = document.getElementById('reg-error');

    btn.textContent = 'Creando cuenta...';
    btn.disabled = true;

    const result = await Auth.register(name, lastname, email, pass, role);

    btn.textContent = 'Crear cuenta';
    btn.disabled = false;

    if (!result.ok) {
        errEl.textContent = result.msg;
        errEl.style.display = 'block';
        return;
    }

    // Caso: requiere confirmación de email
    if (result.needsConfirmation) {
        closeAuthModal();
        showNotification('📧 Confirma tu email', result.msg, 'success');
        return;
    }

    closeAuthModal();
    updateNavAuth();
    showNotification('¡Registro exitoso!', `Bienvenido a Externado Move, ${name}! 🎉`, 'success');
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
    const firstName  = (user.name    || 'U').charAt(0).toUpperCase();
    const firstLast  = (user.lastname || '').charAt(0).toUpperCase();
    const initials   = firstName + firstLast;
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

document.addEventListener('click', (e) => {
    const userBtn = document.getElementById('nav-user-btn');
    const menu    = document.getElementById('user-menu');
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
   TOAST NOTIFICATIONS — compartido
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
    }, 4000);
}
