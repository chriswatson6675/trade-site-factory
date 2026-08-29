// Orchestrates the post-claim welcome email (mission section 2-4). Called
// from app/owner/page.tsx on every load — cheap and safe to call repeatedly:
// it reads business_members.welcome_email_sent_at first and does nothing
// further once that's set, which is exactly what makes "retry by just
// loading /owner again" a real, safe mechanism (section 4) rather than
// something bespoke.
//
// Deliberately uses the caller's own RLS-scoped Supabase client (the same
// one app/owner/page.tsx already has from lib/supabase/server.ts), not the
// service role: reading/writing the caller's own business_members row is
// already exactly what RLS allows an authenticated owner to do (see
// supabase/SECURITY.md), so there is no new privileged surface here beyond
// the narrow mark_welcome_email_sent() RPC added by
// supabase/migrations/20260829182929_owner_welcome_email.sql.
//
// manageUrl/viewUrl are passed in already resolved (lib/site-url.ts) rather
// than re-derived here, so the caller (which needs them for the success
// screen and the dashboard's own "view my website" link regardless) fetches
// site_configurations exactly once per page load.
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail as defaultSendEmail, type SendEmailInput } from '../email/resend.ts';
import { buildOwnerWelcomeEmail } from '../email/welcome-email.ts';

export type WelcomeEmailOutcome = 'sent' | 'already-sent' | 'no-recipient' | 'failed';

export type EnsureWelcomeEmailParams = {
  businessId: string;
  businessName: string;
  ownerEmail: string | null | undefined;
  manageUrl: string;
  viewUrl: string;
};

export type EnsureWelcomeEmailDeps = {
  sendEmail: (input: SendEmailInput) => Promise<void>;
};

export async function ensureOwnerWelcomeEmailSent(
  client: SupabaseClient,
  { businessId, businessName, ownerEmail, manageUrl, viewUrl }: EnsureWelcomeEmailParams,
  deps: EnsureWelcomeEmailDeps = { sendEmail: defaultSendEmail },
): Promise<WelcomeEmailOutcome> {
  const { data: membership, error: membershipError } = await client
    .from('business_members')
    .select('welcome_email_sent_at')
    .eq('business_id', businessId)
    .maybeSingle();
  if (membershipError) {
    console.error('welcome email: could not read membership state:', membershipError.message);
    return 'failed';
  }
  // Already delivered — this is the guard that makes a normal /owner page
  // load a no-op (mission: "subsequent normal page loads do not resend it").
  if (membership?.welcome_email_sent_at) return 'already-sent';

  if (!ownerEmail) {
    console.error(`welcome email: no email on record for the authenticated owner of business ${businessId}`);
    return 'no-recipient';
  }

  const { subject, html, text } = buildOwnerWelcomeEmail({ businessName, manageUrl, viewUrl });

  try {
    await deps.sendEmail({ to: ownerEmail, subject, html, text });
  } catch (cause) {
    // Ownership is untouched by design — this function never writes to
    // business_members except via the success path below, so a failed send
    // never undoes a valid claim (mission: "if email delivery failed,
    // ownership remains valid"). The next /owner load retries automatically.
    console.error(`welcome email: send failed for business ${businessId}:`, cause instanceof Error ? cause.message : cause);
    return 'failed';
  }

  const { error: markError } = await client.rpc('mark_welcome_email_sent', { p_business_id: businessId });
  if (markError) {
    // The email genuinely went out; only the delivery marker failed to
    // write. Worst case is one duplicate send on the next load — never a
    // lost one, and never a reason to touch the membership itself.
    console.error(`welcome email: sent but could not record delivery for business ${businessId} (will retry next load):`, markError.message);
  }

  return 'sent';
}
