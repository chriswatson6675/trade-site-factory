import Link from 'next/link';
import { CompletionApp } from '../../../../components/completion-app';
import { ConfigRequired } from '../../../../components/config-required';
import { Listing, PageChrome } from '../../../../components/public-site';
import { getDataMode } from '../../../../lib/data/mode';
import { loadPublicSite } from '../../../../lib/data/public-loader';
import { slugify } from '../../../../lib/domain';

export const dynamic = 'force-dynamic';

export default async function ServicesPage({ params }: { params: Promise<{ businessSlug: string }> }) {
  const mode = getDataMode();
  if (mode === 'unconfigured-production') return <ConfigRequired />;
  if (mode === 'demo') return <CompletionApp />;

  const { businessSlug } = await params;
  const { business } = await loadPublicSite(businessSlug);
  const root = `/sites/${business.slug}`;
  return (
    <PageChrome business={business}>
      <Listing eyebrow="What we do" title="Scaffolding services.">
        <div className="cards">
          {business.services.map((service) => (
            <Link className="card" href={`${root}/services/${slugify(service)}`} key={service}>
              <h2>{service}</h2>
              <p>Find out how we can help with this type of work.</p>
              <b>→</b>
            </Link>
          ))}
        </div>
      </Listing>
    </PageChrome>
  );
}
