import { redirect } from 'next/navigation';
import { ClaimBusiness } from '../../components/claim-business';
import { CompletionApp } from '../../components/completion-app';
import { ConfigRequired } from '../../components/config-required';
import { OwnerAppBridge } from '../../components/owner-app-bridge';
import { getOwnerBusinesses } from '../../lib/data/business-repository';
import { getOwnerEnquiries } from '../../lib/data/enquiry-repository';
import { getDataMode } from '../../lib/data/mode';
import { getOwnerProjects } from '../../lib/data/project-repository';
import { createClient } from '../../lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function OwnerPage() {
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
  if (businesses.length === 0) return <ClaimBusiness />;

  const business = businesses[0];
  const [projects, enquiries] = await Promise.all([getOwnerProjects(supabase, business.id), getOwnerEnquiries(supabase, business.id)]);

  return <OwnerAppBridge businessId={business.id} business={business} projects={projects} enquiries={enquiries} />;
}
