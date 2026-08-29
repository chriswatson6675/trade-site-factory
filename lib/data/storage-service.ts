// Thin wrapper around Supabase Storage for the two buckets this app uses.
// project-images is public (see supabase/migrations/20260829120400_storage_buckets.sql);
// enquiry-images is private and only ever read via short-lived signed URLs.
import type { SupabaseClient } from '@supabase/supabase-js';
import { enquiryImagePath, projectImagePath } from './storage-paths.ts';

export const PROJECT_IMAGES_BUCKET = 'project-images';
export const ENQUIRY_IMAGES_BUCKET = 'enquiry-images';

export async function uploadProjectImage(
  client: SupabaseClient,
  businessId: string,
  projectId: string,
  file: File,
): Promise<string> {
  const path = projectImagePath(businessId, projectId, file.type);
  const { error } = await client.storage.from(PROJECT_IMAGES_BUCKET).upload(path, file, { contentType: file.type });
  if (error) throw new Error(`Could not upload photo: ${error.message}`);
  return path;
}

export function publicProjectImageUrl(client: SupabaseClient, path: string): string {
  return client.storage.from(PROJECT_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function removeProjectImages(client: SupabaseClient, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await client.storage.from(PROJECT_IMAGES_BUCKET).remove(paths);
  if (error) console.error('Could not remove project photos from storage', error.message);
}

export async function uploadEnquiryImage(
  client: SupabaseClient,
  businessId: string,
  enquiryId: string,
  file: File,
): Promise<string> {
  const path = enquiryImagePath(businessId, enquiryId, file.type);
  const { error } = await client.storage.from(ENQUIRY_IMAGES_BUCKET).upload(path, file, { contentType: file.type });
  if (error) throw new Error(`Could not upload photo: ${error.message}`);
  return path;
}

/** Bulk-signs enquiry photo paths (private bucket) — used by the owner enquiries screen only. */
export async function signedEnquiryImageUrls(
  client: SupabaseClient,
  paths: string[],
  expiresInSeconds = 3600,
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await client.storage.from(ENQUIRY_IMAGES_BUCKET).createSignedUrls(paths, expiresInSeconds);
  if (error) throw new Error(`Could not sign photo URLs: ${error.message}`);
  const map: Record<string, string> = {};
  (data ?? []).forEach((entry) => {
    if (entry.signedUrl && entry.path) map[entry.path] = entry.signedUrl;
  });
  return map;
}
