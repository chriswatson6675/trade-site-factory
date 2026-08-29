import { notFound } from 'next/navigation';
import { CompletionApp } from '../../../../../components/completion-app';
import { ConfigRequired } from '../../../../../components/config-required';
import { AreaPage as AreaView, PageChrome } from '../../../../../components/public-site';
import { getDataMode } from '../../../../../lib/data/mode';
import { loadPublicSite } from '../../../../../lib/data/public-loader';
import { declaredArea } from '../../../../../lib/domain';

export const dynamic = 'force-dynamic';

export default async function AreaPage({ params }: { params: Promise<{ businessSlug: string; areaSlug: string }> }) {
  const mode = getDataMode();
  if (mode === 'unconfigured-production') return <ConfigRequired />;
  if (mode === 'demo') return <CompletionApp />;

  const { businessSlug, areaSlug } = await params;
  const { business, projects } = await loadPublicSite(businessSlug);
  const area = declaredArea(business.areas, areaSlug);
  if (!area) notFound();
  return (
    <PageChrome business={business}>
      <AreaView business={business} area={area} projects={projects} />
    </PageChrome>
  );
}
