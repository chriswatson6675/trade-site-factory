// Central place for reading/validating Supabase configuration. Nothing here
// imports a Supabase SDK — it's pure env-var plumbing so both client and
// server code can share the same "are we configured?" checks.

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True once both public Supabase env vars are present. Safe to read on the client. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * True only for a real Vercel Production deployment (not Preview, not local
 * dev). Used to decide whether missing Supabase config should fail loudly
 * instead of quietly falling back to the local demo adapter — see
 * lib/data/mode.ts.
 */
export const isProductionDeployment = process.env.VERCEL_ENV === 'production';

export function requireSupabaseConfigured(context: string): void {
  if (!isSupabaseConfigured) {
    throw new Error(
      `Supabase is not configured (${context}). Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.`,
    );
  }
}

/** Server-only. Throws with a clear message rather than silently returning undefined. */
export function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. This is required server-side for the enquiry submission route.',
    );
  }
  return key;
}
