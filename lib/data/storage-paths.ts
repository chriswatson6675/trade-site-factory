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

/** Recovers a project-images storage_path from its (public) URL, e.g. to know what to delete when a photo is removed in the edit UI. */
export const storagePathFromPublicProjectImageUrl = (url: string, supabaseUrl: string): string | null => {
  const prefix = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/project-images/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
};
