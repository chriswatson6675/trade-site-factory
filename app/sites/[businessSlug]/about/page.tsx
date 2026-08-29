import { CompletionApp } from '../../../../components/completion-app';
import { ConfigRequired } from '../../../../components/config-required';
import { Listing, PageChrome } from '../../../../components/public-site';
import { getDataMode } from '../../../../lib/data/mode';
import { loadPublicSite } from '../../../../lib/data/public-loader';
import { businessCopy } from '../../../../lib/domain';

export const dynamic = 'force-dynamic';

export default async function AboutPage({ params }: { params: Promise<{ businessSlug: string }> }) {
  const mode = getDataMode();
  if (mode === 'unconfigured-production') return <ConfigRequired />;
  if (mode === 'demo') return <CompletionApp />;

  const { businessSlug } = await params;
  const { business } = await loadPublicSite(businessSlug);
  return (
    <PageChrome business={business}>
      <Listing eyebrow="About us" title={business.name}>
        <p className="large-copy">{businessCopy(business.years, business.services, business.areas)}</p>
        <p>
          Based in {business.town}. Call {business.phone} to discuss your project.
        </p>
      </Listing>
    </PageChrome>
  );
}
