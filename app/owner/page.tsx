import { redirect } from 'next/navigation';
import { CompletionApp } from '../../components/completion-app';
import { ConfigRequired } from '../../components/config-required';
import { NotConnected } from '../../components/not-connected';
import { OwnerAppBridge } from '../../components/owner-app-bridge';
import { OwnerClaimSuccess } from '../../components/owner-claim-success';
import { getOwnerBusinesses } from '../../lib/data/business-repository';
import { getOwnerEnquiries } from '../../lib/data/enquiry-repository';
import { getDataMode } from '../../lib/data/mode';
import { getOwnerProjects } from '../../lib/data/project-repository';
import { ensureOwnerWelcomeEmailSent } from '../../lib/data/welcome-email';
import { requestOrigin } from '../../lib/request-origin';
import { ownerManagementUrl, publicSiteUrl } from '../../lib/site-url';
import { createClient } from '../../lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function OwnerPage({ searchParams }: { searchParams: Promise<{ claimed?: string }> }) {
  const mode = getDataMode();
  if (mode === 'unconfigured-production') return <ConfigRequired />;
  if (mode === 'demo') return <CompletionApp />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // The proxy (lib/supabase/proxy.ts) already redirects unauthenticated
  // visitors before this ever renders; this is the defence-in-depth check
  // for a direct server render.
  if (!user) redirect('/owner/sign-in');

  const businesses = await getOwnerBusinesses(supabase);
  if (businesses.length === 0) return <NotConnected />;

  const business = businesses[0];

  const { claimed } = await searchParams;
  const origin = await requestOrigin();
  const manageUrl = ownerManagementUrl(origin);

  const { data: siteConfig } = await supabase.from('site_configurations').select('custom_domain').eq('business_id', business.id).maybeSingle();
  const viewUrl = publicSiteUrl(business, siteConfig ? { customDomain: siteConfig.custom_domain } : null, origin);

  // Idempotent (business_members.welcome_email_sent_at guards it) — safe to
  // attempt on every load, which is also how a previously-failed send gets
  // retried without a new claim token (mission section 4).
  const emailOutcome = await ensureOwnerWelcomeEmailSent(supabase, {
    businessId: business.id,
    businessName: business.name,
    ownerEmail: user.email,
    manageUrl,
    viewUrl,
  });

  // Rendered only immediately after a successful claim redirect (mission
  // section 5) — see components/claim-redeem.tsx for where ?claimed=1 comes
  // from. A normal /owner visit never carries it.
  if (claimed === '1') {
    return <OwnerClaimSuccess businessName={business.name} manageUrl={manageUrl} viewUrl={viewUrl} emailSent={emailOutcome === 'sent' || emailOutcome === 'already-sent'} />;
  }

  const [projects, enquiries] = await Promise.all([getOwnerProjects(supabase, business.id), getOwnerEnquiries(supabase, business.id)]);

  return <OwnerAppBridge businessId={business.id} business={business} projects={projects} enquiries={enquiries} publicSiteUrl={viewUrl} />;
}
