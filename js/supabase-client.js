/* ============================================
   SUPABASE CLIENT — Configuración global
   ============================================ */

const SUPABASE_URL = 'https://lcxlcmvvzxbndiddjnsn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeGxjbXZ2enhibmRpZGRqbnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NjMyODcsImV4cCI6MjA4OTQzOTI4N30.hUG0UBKfBhCq-EHVtPBo7uRxr0rl7hMBT8mhZZk3WfE';

// El UMD de unpkg carga el SDK en window.supabase (el namespace).
// Guardamos la referencia al SDK ANTES de que cualquier código la sobreescriba,
// luego creamos la instancia del cliente.
const _supabaseSDK = window.supabase;
let supabase;

try {
    if (!_supabaseSDK || typeof _supabaseSDK.createClient !== 'function') {
        throw new Error('Supabase SDK no disponible en window.supabase');
    }
    supabase = _supabaseSDK.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('[Externado Move] ✅ Supabase cliente inicializado correctamente.');
} catch (e) {
    console.error('[Externado Move] ❌ Error inicializando Supabase:', e.message);
    // Fallback para que el resto del código no explote sin conexión
    supabase = {
        auth: {
            getSession:           async () => ({ data: { session: null }, error: null }),
            signUp:               async () => ({ data: {}, error: { message: 'Sin conexión a Supabase' } }),
            signInWithPassword:   async () => ({ data: {}, error: { message: 'Sin conexión a Supabase' } }),
            signOut:              async () => ({}),
            onAuthStateChange:    () => {},
        },
        from: () => ({
            select:  () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }), single: async () => ({ data: null, error: null }), ascending: () => ({ limit: async () => ({ data: [], error: null }) }) }),
            insert:  () => ({ select: () => ({ single: async () => ({ data: null, error: { message: 'Sin conexión' } }) }) }),
            update:  () => ({ eq: async () => ({ error: null }) }),
            delete:  () => ({ eq: async () => ({ error: null }) }),
            upsert:  async () => ({ error: null }),
            eq:      () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }), order: () => ({ ascending: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
            order:   () => ({ ascending: () => ({ limit: async () => ({ data: [], error: null }) }) }),
        }),
    };
}
