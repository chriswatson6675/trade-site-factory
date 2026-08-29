import { isProductionDeployment, isSupabaseConfigured } from '../env';

/**
 * Decides which data adapter the app should use.
 *
 * - 'supabase': Supabase env vars are present — always used when available,
 *   in any environment (local, preview or production).
 * - 'demo': not configured, and this is not a real Vercel Production
 *   deployment (local dev, or a preview build before the Founder has added
 *   Supabase env vars). Falls back to the seeded localStorage adapter, with
 *   the existing "DEMO MODE" banner — never silent.
 * - 'unconfigured-production': not configured, and this IS a Production
 *   deployment. Must fail clearly instead of silently using localStorage —
 *   see app/config-required/page.tsx.
 */
export type DataMode = 'supabase' | 'demo' | 'unconfigured-production';

export function getDataMode(): DataMode {
  if (isSupabaseConfigured) return 'supabase';
  if (isProductionDeployment) return 'unconfigured-production';
  return 'demo';
}
