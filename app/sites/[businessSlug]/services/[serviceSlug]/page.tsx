import { notFound } from 'next/navigation';
import { CompletionApp } from '../../../../../components/completion-app';
import { ConfigRequired } from '../../../../../components/config-required';
import { PageChrome, ServicePage as ServiceView } from '../../../../../components/public-site';
import { getDataMode } from '../../../../../lib/data/mode';
import { loadPublicSite } from '../../../../../lib/data/public-loader';
import { selectedService } from '../../../../../lib/domain';

export const dynamic = 'force-dynamic';

export default async function ServicePage({ params }: { params: Promise<{ businessSlug: string; serviceSlug: string }> }) {
  const mode = getDataMode();
  if (mode === 'unconfigured-production') return <ConfigRequired />;
  if (mode === 'demo') return <CompletionApp />;

  const { businessSlug, serviceSlug } = await params;
  const { business, projects } = await loadPublicSite(businessSlug);
  const service = selectedService(business.services, serviceSlug);
  if (!service) notFound();
  return (
    <PageChrome business={business}>
      <ServiceView business={business} service={service} projects={projects} />
    </PageChrome>
  );
}
