// Orchestrates the two-phase, direct-to-Storage public enquiry submission
// (mission sections 4-8). Kept independent of Next.js request/response
// types so it's unit-testable against a fake Supabase client — see
// app/api/enquiries/route.ts and app/api/enquiries/confirm/route.ts for the
// thin HTTP adapters that call into this.
//
// PENDING vs CONFIRMED: a photo-bearing enquiry is created with
// confirmed_at = null ("pending") — invisible to the owner (RLS requires
// confirmed_at is not null, and transition_enquiry_status() refuses
// pending rows too) until phase 2 verifies every photo actually landed in
// Storage, at which point confirm_pending_enquiry() atomically flips it to
// confirmed. A no-photo submission is confirmed immediately in the same
// insert that creates it — there is nothing left to verify.
//
// CONFIRMATION CAPABILITY: the enquiry's UUID alone is never sufficient to
// trigger phase 2's verify-or-rollback (a destructive operation for an
// unauthenticated caller) — phase 1 also issues a random, high-entropy
// confirmation token (hash-only persisted, in enquiry_confirmation_tokens)
// that the browser must present back in phase 2. confirm_pending_enquiry()
// verifies it atomically against the stored hash.
//
// Phase 1 (startEnquirySubmission): validates, allocates the reference,
// creates the enquiry row and (if there are photos) one enquiry_images row
// per photo up front with its final storage_path, plus one confirmation
// token, then mints a short-lived signed *upload* URL for each photo — the
// browser uploads directly to Storage, never proxying bytes through this
// server. If reserving any of this fails partway through, the whole
// pending enquiry is deleted (cascading its image/token rows) before the
// failure is reported — no reference is ever reported successful for a
// submission that wasn't durably and completely persisted.
//
// Phase 2 (confirmEnquirySubmission): requires the matching confirmation
// token, then independently verifies — via the service role, never
// trusting the client's own claim of success — that every reserved
// storage_path actually has an object. Only then is confirm_pending_enquiry()
// called. If even one photo is missing, the whole enquiry is rolled back
// (row deleted, cascading its image/token rows; any objects that did
// upload are best-effort removed) and a clear failure is returned — the
// customer must never be told photos were received when they weren't.
// Reference-number gaps left behind are acceptable.
import type { SupabaseClient } from '@supabase/supabase-js';
import { allocateEnquiryReference } from './reference.ts';
import type { ParsedEnquiryInput } from './enquiry-validation.ts';
import { createEnquiryImageUploadSlot, enquiryImageExists, removeEnquiryImages } from './storage-service.ts';
import { generateSecureToken, hashSecureToken } from '../secure-token.ts';

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
  | { status: 'pending-uploads'; enquiryId: string; confirmationToken: string; reference: string; uploads: UploadSlot[] };

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
  const hasPhotos = input.photos.length > 0;

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
      // No-photo submissions have nothing left to verify, so they're
      // confirmed the instant the row durably exists (mission section 4).
      // Photo submissions stay pending until confirmEnquirySubmission()
      // succeeds.
      confirmed_at: hasPhotos ? null : new Date().toISOString(),
    })
    .select('id')
    .single();
  if (insertError || !enquiry) {
    throw new EnquirySubmissionError('We could not save your enquiry. Your details are still here — please try again.', 500);
  }

  if (!hasPhotos) {
    return { status: 'complete', reference };
  }

  // Reserve one upload slot + confirmation token per photo. Nothing here
  // has asked the browser to upload anything yet, so on any failure we can
  // simply delete the whole pending enquiry (mission section 7) rather
  // than leaving a half-prepared row behind.
  try {
    const confirmationToken = generateSecureToken();
    const { error: tokenError } = await client
      .from('enquiry_confirmation_tokens')
      .insert({ enquiry_id: enquiry.id, token_hash: hashSecureToken(confirmationToken) });
    if (tokenError) throw new Error(`Could not reserve a confirmation token: ${tokenError.message}`);

    const uploads: UploadSlot[] = [];
    for (const photo of input.photos) {
      const slot = await createEnquiryImageUploadSlot(client, business.id, enquiry.id, photo.mimeType);
      const { error: imageRowError } = await client
        .from('enquiry_images')
        .insert({ enquiry_id: enquiry.id, business_id: business.id, storage_path: slot.path });
      if (imageRowError) throw new Error(`Could not reserve a photo slot: ${imageRowError.message}`);
      uploads.push(slot);
    }

    return { status: 'pending-uploads', enquiryId: enquiry.id, confirmationToken, reference, uploads };
  } catch (cause) {
    await client.from('enquiries').delete().eq('id', enquiry.id); // cascades enquiry_images + enquiry_confirmation_tokens
    console.error('enquiry phase-1 reservation failed, pending enquiry rolled back', cause);
    throw new EnquirySubmissionError('We could not save your enquiry. Please try again.', 500);
  }
}

export type ConfirmEnquiryResult = { status: 'complete'; reference: string };

export async function confirmEnquirySubmission(client: SupabaseClient, enquiryId: string, confirmationToken: string): Promise<ConfirmEnquiryResult> {
  const { data: enquiry, error: enquiryError } = await client
    .from('enquiries')
    .select('id, reference, confirmed_at')
    .eq('id', enquiryId)
    .maybeSingle();
  if (enquiryError) throw new Error(`Could not look up enquiry: ${enquiryError.message}`);
  if (!enquiry) throw new EnquirySubmissionError('Unknown enquiry.', 404);
  if (enquiry.confirmed_at) {
    // Already confirmed — never rolled back through this endpoint, whether
    // called again by mistake or maliciously.
    throw new EnquirySubmissionError('This enquiry has already been confirmed.', 409);
  }

  // Check the token before touching Storage or deleting anything: the
  // enquiry UUID alone must never be sufficient to trigger the rollback
  // path below (mission section 6). This is a fast-fail convenience —
  // confirm_pending_enquiry() re-verifies the token itself, atomically,
  // and is the true authority.
  const { data: tokenRow, error: tokenError } = await client
    .from('enquiry_confirmation_tokens')
    .select('token_hash')
    .eq('enquiry_id', enquiryId)
    .maybeSingle();
  if (tokenError) throw new Error(`Could not look up confirmation token: ${tokenError.message}`);
  if (!tokenRow || tokenRow.token_hash !== hashSecureToken(confirmationToken)) {
    throw new EnquirySubmissionError('Invalid confirmation token.', 403);
  }

  const { data: images, error: imagesError } = await client.from('enquiry_images').select('storage_path').eq('enquiry_id', enquiryId);
  if (imagesError) throw new Error(`Could not load photo slots: ${imagesError.message}`);
  const paths = ((images ?? []) as { storage_path: string }[]).map((row) => row.storage_path);

  if (paths.length > 0) {
    const present = await Promise.all(paths.map((path) => enquiryImageExists(client, path)));
    const missing = paths.some((_, index) => !present[index]);
    if (missing) {
      // A submission containing photographs must not be reported as
      // successful when a requested photograph failed to persist (mission
      // section 7) — roll the whole enquiry back rather than record it as
      // "received" with photos absent.
      const uploaded = paths.filter((_, index) => present[index]);
      await client.from('enquiries').delete().eq('id', enquiryId); // cascades enquiry_images + enquiry_confirmation_tokens
      await removeEnquiryImages(client, uploaded);
      throw new EnquirySubmissionError(
        'Not all of your photos were received. Please try submitting again — your other details are unaffected.',
        422,
      );
    }
  }

  const { data: confirmed, error: confirmError } = await client.rpc('confirm_pending_enquiry', {
    p_enquiry_id: enquiryId,
    p_token: confirmationToken,
  });
  if (confirmError || !confirmed) {
    throw new EnquirySubmissionError('Could not confirm this enquiry. Please try again.', 500);
  }

  return { status: 'complete', reference: (confirmed as { reference: string }).reference };
}
