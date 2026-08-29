// Production adapter boundary. It is selected only when Supabase environment values exist.
// Browser UI never receives a service-role key; RLS and Storage policies are enforced server-side.
export const productionMode=Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
