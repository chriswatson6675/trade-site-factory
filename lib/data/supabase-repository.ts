// Configuration detection only; this is not a production persistence adapter.
// A future server-side SupabaseRepository will implement Repository, private
// Storage uploads and authenticated RLS. Never expose a service-role key here.
export const productionModeConfigured=Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
