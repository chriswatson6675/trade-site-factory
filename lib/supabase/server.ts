// Server Supabase client for Server Components, Route Handlers and Server
// Actions — reads/writes the user's session via Next's cookie jar, so RLS
// runs as that user (anonymous visitor or authenticated owner).
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { requireSupabaseConfigured, supabaseAnonKey, supabaseUrl } from '../env';

export async function createClient() {
  requireSupabaseConfigured('server client');
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component that can't set cookies — the
          // proxy (lib/supabase/proxy.ts) already refreshes the session on
          // every request, so this is safe to ignore.
        }
      },
    },
  });
}
