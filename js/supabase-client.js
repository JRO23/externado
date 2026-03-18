/* ============================================
   SUPABASE CLIENT — Configuración global
   ============================================ */

const SUPABASE_URL = 'https://lcxlcmvvzxbndiddjnsn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_2H9RkxrzMXDrQeS5TjqKfw_LhZxFDVk';

// Inicializar cliente usando el SDK de Supabase (cargado vía CDN)
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
