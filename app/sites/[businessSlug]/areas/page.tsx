import Link from 'next/link';
import { CompletionApp } from '../../../../components/completion-app';
import { ConfigRequired } from '../../../../components/config-required';
import { Listing, PageChrome } from '../../../../components/public-site';
import { getDataMode } from '../../../../lib/data/mode';
import { loadPublicSite } from '../../../../lib/data/public-loader';
import { slugify } from '../../../../lib/domain';

export const dynamic = 'force-dynamic';

export default async function AreasPage({ params }: { params: Promise<{ businessSlug: string }> }) {
  const mode = getDataMode();
  if (mode === 'unconfigured-production') return <ConfigRequired />;
  if (mode === 'demo') return <CompletionApp />;

  const { businessSlug } = await params;
  const { business } = await loadPublicSite(businessSlug);
  const root = `/sites/${business.slug}`;
  return (
    <PageChrome business={business}>
      <Listing eyebrow="Where we work" title="Areas we cover.">
        <div className="cards">
          {business.areas.map((area) => (
            <Link className="card" href={`${root}/areas/${slugify(area)}`} key={area}>
              <h2>{area}</h2>
              <b>→</b>
            </Link>
          ))}
        </div>
      </Listing>
    </PageChrome>
  );
}
