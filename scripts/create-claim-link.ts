// One-time business ownership handover. Run by the Founder/platform
// operator only — never from application code.
//
//   node --experimental-strip-types scripts/create-claim-link.ts <business-slug> [expiresInHours=72]
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the
// environment. Prints a one-time link; send it to the intended owner. The
// raw token is never written anywhere except this terminal output — only
// its SHA-256 hash is stored, in business_claims.token_hash.
import { createClient } from '@supabase/supabase-js';
import { generateSecureToken, hashSecureToken } from '../lib/secure-token.ts';

async function main() {
  const [, , slug, hoursArg] = process.argv;
  if (!slug) {
    console.error('Usage: node --experimental-strip-types scripts/create-claim-link.ts <business-slug> [expiresInHours=72]');
    process.exitCode = 1;
    return;
  }
  const hours = hoursArg ? Number(hoursArg) : 72;
  if (!Number.isFinite(hours) || hours <= 0) {
    console.error('expiresInHours must be a positive number.');
    process.exitCode = 1;
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.');
    process.exitCode = 1;
    return;
  }

  const client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  const { data: business, error: businessError } = await client.from('businesses').select('id').eq('slug', slug).maybeSingle();
  if (businessError) {
    console.error(`Could not look up business "${slug}": ${businessError.message}`);
    process.exitCode = 1;
    return;
  }
  if (!business) {
    console.error(`No business found for slug "${slug}".`);
    process.exitCode = 1;
    return;
  }

  const token = generateSecureToken();
  const tokenHash = hashSecureToken(token);
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  const { error: insertError } = await client.from('business_claims').insert({
    business_id: business.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });
  if (insertError) {
    console.error(`Could not create the claim: ${insertError.message}`);
    process.exitCode = 1;
    return;
  }

  const siteUrl = (process.env.SITE_URL ?? 'https://your-deployment.example').replace(/\/$/, '');
  console.log(`One-time claim link for "${slug}" (expires in ${hours}h) — send this to the owner:`);
  console.log(`${siteUrl}/owner/claim?token=${token}`);
}

await main();
