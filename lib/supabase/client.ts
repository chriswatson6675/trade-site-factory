'use client';
// Browser Supabase client. Uses the anon key only — safe to ship to the
// client, RLS is what keeps data safe. createBrowserClient already
// singletons internally, so it's fine to call this on every render.
import { createBrowserClient } from '@supabase/ssr';
import { requireSupabaseConfigured, supabaseAnonKey, supabaseUrl } from '../env';

export function createClient() {
  requireSupabaseConfigured('browser client');
  return createBrowserClient(supabaseUrl!, supabaseAnonKey!);
}
