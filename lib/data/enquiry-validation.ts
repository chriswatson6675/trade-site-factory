// Server-side validation for POST /api/enquiries. The client (PhotoPicker,
// validEnquiry in lib/domain) already validates for UX, but a request can
// always bypass the browser, so this is the real source of truth.
//
// Photos are no longer proxied through this route as bytes (see
// lib/data/enquiry-submission.ts) — the client sends only metadata
// (mimeType/size) here, gets back a signed upload URL per photo, and
// uploads directly to Storage. The bucket's own file_size_limit /
// allowed_mime_types (supabase/migrations/20260829120400_storage_buckets.sql)
// enforce the real bytes; this only sanity-checks what the client claims.

export type EnquiryPhotoMeta = { mimeType: string; size: number };

export type ParsedEnquiryInput = {
  customerName: string;
  mobile: string;
  email?: string;
  location: string;
  preferredContact?: string;
  workType: string;
  storeys: string;
  accessAreas: string;
  width: string;
  dimensions?: string;
  description: string;
  photos: EnquiryPhotoMeta[];
};

export type EnquiryValidationResult = { ok: true; value: ParsedEnquiryInput } | { ok: false; error: string };

const MAX_PHOTOS = 6;
const MAX_PHOTO_BYTES = 10_000_000;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']);

// Generous but finite — an anonymous, internet-facing endpoint should never
// accept an unbounded string into the database (mission section 12).
const FIELD_LIMITS: Record<string, number> = {
  customerName: 120,
  mobile: 32,
  email: 254,
  location: 200,
  preferredContact: 32,
  workType: 60,
  storeys: 40,
  accessAreas: 120,
  width: 40,
  dimensions: 200,
  description: 4000,
};

type Body = Record<string, unknown>;

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export const parseBusinessSlug = (body: Body): string => text(body.businessSlug);

/** A hidden form field real customers never fill in; a non-empty value means the request almost certainly came from a bot. */
export const isHoneypotTripped = (body: Body): boolean => text(body.website).length > 0;

function firstFieldTooLong(fields: Record<string, string>): string | undefined {
  return Object.entries(fields).find(([key, value]) => value.length > (FIELD_LIMITS[key] ?? Infinity))?.[0];
}

export function parseEnquirySubmission(body: Body): EnquiryValidationResult {
  const fields = {
    customerName: text(body.name),
    mobile: text(body.mobile),
    email: text(body.email),
    location: text(body.location),
    preferredContact: text(body.preferredContact),
    workType: text(body.work),
    storeys: text(body.storeys),
    accessAreas: text(body.access),
    width: text(body.width),
    dimensions: text(body.dimensions),
    description: text(body.description),
  };

  if (!fields.customerName || !fields.mobile || !fields.location || !fields.workType || !fields.storeys || !fields.accessAreas || !fields.width || !fields.description) {
    return { ok: false, error: 'Complete the required details. "Not sure" is fine where offered.' };
  }

  const tooLong = firstFieldTooLong(fields);
  if (tooLong) return { ok: false, error: 'One of the details entered is too long.' };

  const rawPhotos = Array.isArray(body.photos) ? body.photos : [];
  if (rawPhotos.length > MAX_PHOTOS) return { ok: false, error: `You can add up to ${MAX_PHOTOS} photos.` };

  const photos: EnquiryPhotoMeta[] = [];
  for (const entry of rawPhotos) {
    if (!entry || typeof entry !== 'object') return { ok: false, error: 'One of those photos could not be read.' };
    const mimeType = text((entry as Body).mimeType).toLowerCase();
    const size = Number((entry as Body).size);
    if (!ALLOWED_MIME_TYPES.has(mimeType)) return { ok: false, error: 'One of those photos is not an accepted image type.' };
    if (!Number.isFinite(size) || size <= 0 || size > MAX_PHOTO_BYTES) return { ok: false, error: 'One of those photos is larger than 10 MB.' };
    photos.push({ mimeType, size });
  }

  return {
    ok: true,
    value: {
      customerName: fields.customerName,
      mobile: fields.mobile,
      email: fields.email || undefined,
      location: fields.location,
      preferredContact: fields.preferredContact || undefined,
      workType: fields.workType,
      storeys: fields.storeys,
      accessAreas: fields.accessAreas,
      width: fields.width,
      dimensions: fields.dimensions || undefined,
      description: fields.description,
      photos,
    },
  };
}
