// Orchestrates the two-phase, direct-to-Storage public enquiry submission
// (mission sections 7 & 8). Kept independent of Next.js request/response
// types so it's unit-testable against a fake Supabase client — see
// app/api/enquiries/route.ts and app/api/enquiries/confirm/route.ts for the
// thin HTTP adapters that call into this.
//
// Phase 1 (startEnquirySubmission): validates, allocates the reference,
// creates the enquiry row and (if there are photos) one enquiry_images row
// per photo up front with its final storage_path, then mints a short-lived
// signed *upload* URL for each — the browser uploads directly to Storage,
// never proxying bytes through this server. A submission with zero photos
// is already complete after this phase.
//
// Phase 2 (confirmEnquirySubmission): independently verifies — via the
// service role, never trusting the client's own claim of success — that
// every reserved storage_path actually has an object. Only then is the
// submission "complete". If even one photo is missing, the whole enquiry
// is rolled back (row deleted, cascading its enquiry_images; any objects
// that did upload are best-effort removed) and a clear failure is
// returned — the customer must never be told photos were received when
// they weren't. Reference-number gaps left behind are acceptable.
import type { SupabaseClient } from '@supabase/supabase-js';
import { allocateEnquiryReference } from './reference.ts';
import type { ParsedEnquiryInput } from './enquiry-validation.ts';
import { createEnquiryImageUploadSlot, enquiryImageExists, removeEnquiryImages } from './storage-service.ts';

export class EnquirySubmissionError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'EnquirySubmissionError';
    this.status = status;
  }
}

export type StartEnquiryInput = ParsedEnquiryInput & { businessSlug: string };

export type UploadSlot = { path: string; token: string; signedUrl: string };

export type StartEnquiryResult =
  | { status: 'complete'; reference: string }
  | { status: 'pending-uploads'; enquiryId: string; reference: string; uploads: UploadSlot[] };

export async function startEnquirySubmission(client: SupabaseClient, input: StartEnquiryInput): Promise<StartEnquiryResult> {
  // Mission section 11: only a published business may receive public
  // enquiries — draft/preview/withdrawn businesses are rejected even
  // though this route runs with the service role (which would otherwise
  // bypass the RLS policy that enforces the same rule for ordinary reads).
  const { data: business, error: businessError } = await client
    .from('businesses')
    .select('id')
    .eq('slug', input.businessSlug)
    .eq('site_status', 'published')
    .maybeSingle();
  if (businessError) throw new Error(`Could not look up business: ${businessError.message}`);
  if (!business) throw new EnquirySubmissionError('Unknown business.', 404);

  const reference = await allocateEnquiryReference(client, business.id);

  const { data: enquiry, error: insertError } = await client
    .from('enquiries')
    .insert({
      business_id: business.id,
      reference,
      customer_name: input.customerName,
      mobile: input.mobile,
      email: input.email ?? null,
      location: input.location,
      preferred_contact: input.preferredContact ?? null,
      work_type: input.workType,
      storeys: input.storeys,
      access_areas: input.accessAreas,
      width: input.width,
      dimensions: input.dimensions ?? null,
      description: input.description,
      status: 'new',
    })
    .select('id')
    .single();
  if (insertError || !enquiry) {
    throw new EnquirySubmissionError('We could not save your enquiry. Your details are still here — please try again.', 500);
  }

  if (input.photos.length === 0) {
    return { status: 'complete', reference };
  }

  const uploads: UploadSlot[] = [];
  for (const photo of input.photos) {
    const slot = await createEnquiryImageUploadSlot(client, business.id, enquiry.id, photo.mimeType);
    const { error: imageRowError } = await client
      .from('enquiry_images')
      .insert({ enquiry_id: enquiry.id, business_id: business.id, storage_path: slot.path });
    if (imageRowError) throw new Error(`Could not reserve a photo slot: ${imageRowError.message}`);
    uploads.push(slot);
  }

  return { status: 'pending-uploads', enquiryId: enquiry.id, reference, uploads };
}

export type ConfirmEnquiryResult = { status: 'complete'; reference: string };

export async function confirmEnquirySubmission(client: SupabaseClient, enquiryId: string): Promise<ConfirmEnquiryResult> {
  const { data: enquiry, error: enquiryError } = await client.from('enquiries').select('id, reference').eq('id', enquiryId).maybeSingle();
  if (enquiryError) throw new Error(`Could not look up enquiry: ${enquiryError.message}`);
  if (!enquiry) throw new EnquirySubmissionError('Unknown enquiry.', 404);

  const { data: images, error: imagesError } = await client.from('enquiry_images').select('storage_path').eq('enquiry_id', enquiryId);
  if (imagesError) throw new Error(`Could not load photo slots: ${imagesError.message}`);
  const paths = ((images ?? []) as { storage_path: string }[]).map((row) => row.storage_path);

  if (paths.length === 0) {
    return { status: 'complete', reference: enquiry.reference as string };
  }

  const present = await Promise.all(paths.map((path) => enquiryImageExists(client, path)));
  const missing = paths.some((_, index) => !present[index]);

  if (missing) {
    // A submission containing photographs must not be reported as
    // successful when a requested photograph failed to persist (mission
    // section 7) — roll the whole enquiry back rather than record it as
    // "received" with photos absent.
    const uploaded = paths.filter((_, index) => present[index]);
    await client.from('enquiries').delete().eq('id', enquiryId); // cascades enquiry_images
    await removeEnquiryImages(client, uploaded);
    throw new EnquirySubmissionError(
      'Not all of your photos were received. Please try submitting again — your other details are unaffected.',
      422,
    );
  }

  return { status: 'complete', reference: enquiry.reference as string };
}
