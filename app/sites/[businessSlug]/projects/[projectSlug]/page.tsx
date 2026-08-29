import { notFound } from 'next/navigation';
import { CompletionApp } from '../../../../../components/completion-app';
import { ConfigRequired } from '../../../../../components/config-required';
import { PageChrome, ProjectDetail } from '../../../../../components/public-site';
import { getDataMode } from '../../../../../lib/data/mode';
import { getPublicProjectBySlug } from '../../../../../lib/data/project-repository';
import { getPublishedBusinessBySlug } from '../../../../../lib/data/business-repository';
import { createClient } from '../../../../../lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({ params }: { params: Promise<{ businessSlug: string; projectSlug: string }> }) {
  const mode = getDataMode();
  if (mode === 'unconfigured-production') return <ConfigRequired />;
  if (mode === 'demo') return <CompletionApp />;

  const { businessSlug, projectSlug } = await params;
  const supabase = await createClient();
  const business = await getPublishedBusinessBySlug(supabase, businessSlug);
  if (!business) notFound();
  const project = await getPublicProjectBySlug(supabase, business.id, projectSlug);
  if (!project) notFound();
  return (
    <PageChrome business={business}>
      <ProjectDetail business={business} project={project} />
    </PageChrome>
  );
}
