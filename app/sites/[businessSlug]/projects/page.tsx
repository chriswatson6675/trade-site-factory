import { CompletionApp } from '../../../../components/completion-app';
import { ConfigRequired } from '../../../../components/config-required';
import { Listing, PageChrome, ProjectCards } from '../../../../components/public-site';
import { getDataMode } from '../../../../lib/data/mode';
import { loadPublicSite } from '../../../../lib/data/public-loader';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage({ params }: { params: Promise<{ businessSlug: string }> }) {
  const mode = getDataMode();
  if (mode === 'unconfigured-production') return <ConfigRequired />;
  if (mode === 'demo') return <CompletionApp />;

  const { businessSlug } = await params;
  const { business, projects } = await loadPublicSite(businessSlug);
  return (
    <PageChrome business={business}>
      <Listing eyebrow="Recent work" title="Jobs completed locally.">
        <ProjectCards business={business} projects={projects} />
      </Listing>
    </PageChrome>
  );
}
