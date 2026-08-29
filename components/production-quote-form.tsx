'use client';
import type { Business } from '../lib/data/types';
import type { PhotoItem } from './photo-picker';
import { PageChrome } from './public-site';
import { EnquiryDraft, QuoteForm } from './quote-form';

async function submitEnquiry(business: Business, draft: EnquiryDraft, photos: PhotoItem[]): Promise<{ reference: string }> {
  const formData = new FormData();
  formData.set('businessSlug', business.slug);
  formData.set('name', draft.name ?? '');
  formData.set('mobile', draft.mobile ?? '');
  formData.set('email', draft.email ?? '');
  formData.set('location', draft.location ?? '');
  formData.set('preferredContact', draft.preferredContact ?? '');
  formData.set('work', draft.work ?? '');
  formData.set('storeys', draft.storeys ?? '');
  formData.set('access', draft.access ?? '');
  formData.set('width', draft.width ?? '');
  formData.set('dimensions', draft.dimensions ?? '');
  formData.set('description', draft.description ?? '');
  photos.forEach((photo) => {
    if (photo.file) formData.append('photos', photo.file);
  });

  const response = await fetch('/api/enquiries', { method: 'POST', body: formData });
  const body = await response.json().catch(() => ({}) as { error?: string; reference?: string });
  if (!response.ok) throw new Error(body.error || 'We could not save your enquiry. Please try again.');
  return { reference: body.reference as string };
}

export function ProductionQuoteForm({ business }: { business: Business }) {
  return (
    <PageChrome business={business}>
      <QuoteForm business={business} onSubmit={(draft, photos) => submitEnquiry(business, draft, photos)} />
    </PageChrome>
  );
}
