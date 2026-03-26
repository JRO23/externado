/* ============================================
   SUPABASE CLIENT — Configuración global
   ============================================ */

const SUPABASE_URL = 'https://lcxlcmvvzxbndiddjnsn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_2H9RkxrzMXDrQeS5TjqKfw_LhZxFDVk';

// El bundle CDN de @supabase/supabase-js@2 expone `window.supabase`
// que tiene el método createClient directamente.
const _sb = window.supabase;
if (!_sb || typeof _sb.createClient !== 'function') {
    console.error('[Externado Move] Supabase SDK no cargó correctamente. Verifica tu conexión a internet.');
}
const supabase = _sb.createClient(SUPABASE_URL, SUPABASE_KEY);
