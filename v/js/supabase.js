// Shared Supabase Client
if (typeof CONFIG === 'undefined') console.error("CONFIG missing. Is config.js loaded?");
export const supabase = window.supabase.createClient(
    CONFIG.SUPABASE_URL,
    CONFIG.SUPABASE_KEY,
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
    }
);
