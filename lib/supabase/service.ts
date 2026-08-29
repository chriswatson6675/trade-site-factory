// Service-role Supabase client. NEVER import this from a 'use client' file
// or a browser bundle — it holds a secret that must never leave the
// server. It is used exclusively by app/api/enquiries/route.ts (the one
// deliberately-privileged, server-validated write path described in the
// mission brief) and bypasses Row Level Security entirely, so every call
// site must validate its own inputs before touching the database.
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getServiceRoleKey, requireSupabaseConfigured, supabaseUrl } from '../env';

export function createServiceClient() {
  if (typeof window !== 'undefined') {
    throw new Error('createServiceClient() must never be called in the browser.');
  }
  requireSupabaseConfigured('service client');
  return createSupabaseClient(supabaseUrl!, getServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
