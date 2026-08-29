'use client';
import type { Business } from '../lib/data/types';
import { createClient } from '../lib/supabase/client';
import type { PhotoItem } from './photo-picker';
import { PageChrome } from './public-site';
import { EnquiryDraft, QuoteForm } from './quote-form';

type StartResponse =
  | { status: 'complete'; reference: string }
  | { status: 'pending-uploads'; enquiryId: string; confirmationToken: string; reference: string; uploads: { path: string; token: string; signedUrl: string }[] };

/**
 * Two-phase submission (mission sections 7 & 8): phase 1 validates and
 * reserves an upload slot per photo; the browser then uploads every photo
 * directly to Supabase Storage using its own signed upload token (never
 * proxying bytes through this server); phase 2 asks the server to
 * independently verify every photo actually landed before ever reporting
 * success. Uploads always run to completion and phase 2 is always called
 * — even if an upload looked like it failed client-side — so the server
 * (the only party that re-verifies against Storage) is what decides
 * success/failure and performs any cleanup.
 */
async function submitEnquiry(business: Business, draft: EnquiryDraft, photos: PhotoItem[], honeypot: string): Promise<{ reference: string }> {
  const startResponse = await fetch('/api/enquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessSlug: business.slug,
      name: draft.name,
      mobile: draft.mobile,
      email: draft.email,
      location: draft.location,
      preferredContact: draft.preferredContact,
      work: draft.work,
      storeys: draft.storeys,
      access: draft.access,
      width: draft.width,
      dimensions: draft.dimensions,
      description: draft.description,
      photos: photos.map((photo) => ({ mimeType: photo.file?.type ?? '', size: photo.file?.size ?? 0 })),
      website: honeypot,
    }),
  });
  const startBody = (await startResponse.json().catch(() => ({}))) as Partial<StartResponse> & { error?: string };
  if (!startResponse.ok || !startBody.status) {
    throw new Error(startBody.error || 'We could not save your enquiry. Please try again.');
  }
  if (startBody.status === 'complete') {
    return { reference: startBody.reference! };
  }

  const { enquiryId, confirmationToken, uploads } = startBody as Extract<StartResponse, { status: 'pending-uploads' }>;
  const supabase = createClient();
  await Promise.allSettled(
    uploads.map(async (upload, index) => {
      const file = photos[index]?.file;
      if (!file) throw new Error('missing file');
      const { error } = await supabase.storage.from('enquiry-images').uploadToSignedUrl(upload.path, upload.token, file);
      if (error) throw error;
    }),
  );

  // Always ask the server to confirm — it independently re-checks Storage
  // rather than trusting the outcome of the uploads above, and performs
  // cleanup if anything is missing. confirmationToken is the one-time
  // capability that authorises this — the enquiryId alone is not enough
  // (mission section 6).
  const confirmResponse = await fetch('/api/enquiries/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enquiryId, confirmationToken }),
  });
  const confirmBody = (await confirmResponse.json().catch(() => ({}))) as { reference?: string; error?: string };
  if (!confirmResponse.ok || !confirmBody.reference) {
    throw new Error(confirmBody.error || 'One of your photos could not be uploaded. Please try again.');
  }
  return { reference: confirmBody.reference };
}

export function ProductionQuoteForm({ business }: { business: Business }) {
  return (
    <PageChrome business={business}>
      <QuoteForm business={business} onSubmit={(draft, photos, honeypot) => submitEnquiry(business, draft, photos, honeypot)} />
    </PageChrome>
  );
}
