// Storage path generation. Paths are built entirely from server-generated
// IDs and a MIME-type lookup — never from a user-supplied file name — so an
// uploaded file called "../../secrets.txt" (or anything else) can't steer
// where it lands. See mission section 12.

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

export const extensionForMimeType = (mimeType: string): string => MIME_EXTENSIONS[mimeType.toLowerCase()] ?? 'bin';

export const projectImagePath = (businessId: string, projectId: string, mimeType: string, id = crypto.randomUUID()) =>
  `businesses/${businessId}/projects/${projectId}/${id}.${extensionForMimeType(mimeType)}`;

export const enquiryImagePath = (businessId: string, enquiryId: string, mimeType: string, id = crypto.randomUUID()) =>
  `businesses/${businessId}/enquiries/${enquiryId}/${id}.${extensionForMimeType(mimeType)}`;

/**
 * Recovers a project-images storage_path from one of its own signed URLs
 * (project-images is a private bucket — see
 * supabase/migrations/20260829120400_storage_buckets.sql — so every read
 * is a signed URL, never a bucket-public one), so the owner "remove photo"
 * flow knows what to delete. Signed URLs reliably embed the exact object
 * path ahead of the query string: `.../object/sign/{bucket}/{path}?token=...`.
 */
export const storagePathFromSignedProjectImageUrl = (url: string, supabaseUrl: string): string | null => {
  const prefix = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/sign/project-images/`;
  if (!url.startsWith(prefix)) return null;
  const rest = url.slice(prefix.length);
  const queryIndex = rest.indexOf('?');
  return queryIndex === -1 ? rest : rest.slice(0, queryIndex);
};
