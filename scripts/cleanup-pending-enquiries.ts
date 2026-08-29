// Manual maintenance script — NOT wired to any cron/background job (see
// mission section 8: deliberately out of scope for this build). A customer
// may legitimately close their browser after phase 1 of an enquiry
// submission (POST /api/enquiries) without ever reaching phase 2 — that
// leaves a PENDING enquiry (confirmed_at is null) behind, invisible to the
// owner (RLS requires confirmed_at is not null) but still occupying a row
// and, if it had photos, reserved Storage paths that may or may not have
// received an upload. This script finds pending enquiries older than a
// conservative interval and removes them (plus whatever Storage objects
// they did end up with) — run it by hand, or wire it to a real scheduler
// (Supabase Cron, Vercel Cron, GitHub Actions, ...) once one is chosen.
// Safe to re-run: nothing errors if there's nothing stale to clean up.
//
//   node --experimental-strip-types scripts/cleanup-pending-enquiries.ts [olderThanHours=48]
import { createClient } from '@supabase/supabase-js';

async function main() {
  const hoursArg = process.argv[2];
  const hours = hoursArg ? Number(hoursArg) : 48;
  if (!Number.isFinite(hours) || hours <= 0) {
    console.error('olderThanHours must be a positive number.');
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
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data: stale, error: staleError } = await client
    .from('enquiries')
    .select('id, reference')
    .is('confirmed_at', null)
    .lt('created_at', cutoff);
  if (staleError) {
    console.error(`Could not list stale pending enquiries: ${staleError.message}`);
    process.exitCode = 1;
    return;
  }
  if (!stale || stale.length === 0) {
    console.log(`No pending enquiries older than ${hours}h found.`);
    return;
  }

  console.log(`Found ${stale.length} pending enquiry(ies) older than ${hours}h. Cleaning up…`);
  for (const enquiry of stale as { id: string; reference: string }[]) {
    const { data: images } = await client.from('enquiry_images').select('storage_path').eq('enquiry_id', enquiry.id);
    const paths = ((images ?? []) as { storage_path: string }[]).map((row) => row.storage_path);

    if (paths.length > 0) {
      const { error: removeError } = await client.storage.from('enquiry-images').remove(paths);
      if (removeError) console.error(`  ${enquiry.reference}: could not remove ${paths.length} photo object(s) — ${removeError.message}`);
    }

    // Cascades enquiry_images and enquiry_confirmation_tokens.
    const { error: deleteError } = await client.from('enquiries').delete().eq('id', enquiry.id);
    if (deleteError) {
      console.error(`  ${enquiry.reference}: could not delete — ${deleteError.message}`);
    } else {
      console.log(`  ${enquiry.reference}: removed (${paths.length} photo object(s) cleaned up).`);
    }
  }
}

await main();
