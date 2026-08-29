import { CompletionApp } from '../../../../components/completion-app';
import { ConfigRequired } from '../../../../components/config-required';
import { ProductionQuoteForm } from '../../../../components/production-quote-form';
import { getDataMode } from '../../../../lib/data/mode';
import { loadPublicSite } from '../../../../lib/data/public-loader';

export const dynamic = 'force-dynamic';

export default async function QuotePage({ params }: { params: Promise<{ businessSlug: string }> }) {
  const mode = getDataMode();
  if (mode === 'unconfigured-production') return <ConfigRequired />;
  if (mode === 'demo') return <CompletionApp />;

  const { businessSlug } = await params;
  const { business } = await loadPublicSite(businessSlug);
  return <ProductionQuoteForm business={business} />;
}
