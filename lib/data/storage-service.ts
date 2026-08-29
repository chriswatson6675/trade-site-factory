// Thin wrapper around Supabase Storage for the two buckets this app uses.
// Both are PRIVATE (see supabase/migrations/20260829120400_storage_buckets.sql):
// project-images serves public visitors via short-lived signed URLs gated
// by a storage.objects RLS policy that only matches published projects of
// published businesses; enquiry-images is never public at all.
import type { SupabaseClient } from '@supabase/supabase-js';
import { enquiryImagePath, projectImagePath } from './storage-paths.ts';

export const PROJECT_IMAGES_BUCKET = 'project-images';
export const ENQUIRY_IMAGES_BUCKET = 'enquiry-images';

/** Authenticated owner direct upload — the browser's own Supabase session (RLS-scoped) writes straight to Storage, no server relay. */
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

/** Bulk-signs project photo paths for the public site (anon-key server client; RLS only allows this for published projects of published businesses). */
export async function signedProjectImageUrls(
  client: SupabaseClient,
  paths: string[],
  expiresInSeconds = 3600,
): Promise<Record<string, string>> {
  return signUrls(client, PROJECT_IMAGES_BUCKET, paths, expiresInSeconds);
}

export async function removeProjectImages(client: SupabaseClient, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await client.storage.from(PROJECT_IMAGES_BUCKET).remove(paths);
  if (error) console.error('Could not remove project photos from storage', error.message);
}

/**
 * Server-side (service role) only: mints a one-time, scoped signed *upload*
 * URL for an exact, server-generated enquiry-images path. This is what lets
 * an anonymous customer's browser upload directly to Storage without ever
 * needing a standing anon INSERT policy or seeing the service-role key —
 * the token itself is the (short-lived) authorisation, valid only for this
 * one path.
 */
export async function createEnquiryImageUploadSlot(
  client: SupabaseClient,
  businessId: string,
  enquiryId: string,
  mimeType: string,
): Promise<{ path: string; token: string; signedUrl: string }> {
  const path = enquiryImagePath(businessId, enquiryId, mimeType);
  const { data, error } = await client.storage.from(ENQUIRY_IMAGES_BUCKET).createSignedUploadUrl(path);
  if (error) throw new Error(`Could not authorise photo upload: ${error.message}`);
  return { path, token: data.token, signedUrl: data.signedUrl };
}

/** Server-side (service role) only: verifies a path actually has an object — never trusts the client's own claim that an upload "succeeded". */
export async function enquiryImageExists(client: SupabaseClient, path: string): Promise<boolean> {
  const { error } = await client.storage.from(ENQUIRY_IMAGES_BUCKET).createSignedUrl(path, 60);
  return !error;
}

export async function removeEnquiryImages(client: SupabaseClient, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await client.storage.from(ENQUIRY_IMAGES_BUCKET).remove(paths);
  if (error) console.error('Could not remove orphaned enquiry photos from storage', error.message);
}

/** Bulk-signs enquiry photo paths (private bucket) — owner enquiries screen only. */
export async function signedEnquiryImageUrls(
  client: SupabaseClient,
  paths: string[],
  expiresInSeconds = 3600,
): Promise<Record<string, string>> {
  return signUrls(client, ENQUIRY_IMAGES_BUCKET, paths, expiresInSeconds);
}

async function signUrls(client: SupabaseClient, bucket: string, paths: string[], expiresInSeconds: number): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await client.storage.from(bucket).createSignedUrls(paths, expiresInSeconds);
  if (error) throw new Error(`Could not sign photo URLs: ${error.message}`);
  const map: Record<string, string> = {};
  (data ?? []).forEach((entry) => {
    if (entry.signedUrl && entry.path) map[entry.path] = entry.signedUrl;
  });
  return map;
}
