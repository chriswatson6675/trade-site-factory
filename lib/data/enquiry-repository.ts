import type { SupabaseClient } from '@supabase/supabase-js';
import { assertValidTransition } from './enquiry-status';
import { mapEnquiryRow, type EnquiryRow } from './mappers';
import { signedEnquiryImageUrls } from './storage-service';
import type { Enquiry, Status } from './types';

type EnquiryImageRow = { id: string; enquiry_id: string; storage_path: string; sort_order: number };

/** Relies on RLS ("owner can read own enquiries") for tenant scoping. */
export async function getOwnerEnquiries(client: SupabaseClient, businessId: string): Promise<Enquiry[]> {
  const { data, error } = await client.from('enquiries').select('*').eq('business_id', businessId).order('created_at', { ascending: false });
  if (error) throw new Error(`Could not load enquiries: ${error.message}`);
  const rows = (data ?? []) as EnquiryRow[];
  const ids = rows.map((row) => row.id);

  let imagesByEnquiry: Record<string, EnquiryImageRow[]> = {};
  if (ids.length > 0) {
    const { data: imageRows, error: imagesError } = await client.from('enquiry_images').select('*').in('enquiry_id', ids).order('sort_order');
    if (imagesError) throw new Error(`Could not load enquiry photos: ${imagesError.message}`);
    imagesByEnquiry = {};
    ((imageRows ?? []) as EnquiryImageRow[]).forEach((row) => {
      (imagesByEnquiry[row.enquiry_id] ??= []).push(row);
    });
  }

  const allPaths = Object.values(imagesByEnquiry).flat().map((row) => row.storage_path);
  const signedUrls = await signedEnquiryImageUrls(client, allPaths);

  return rows.map((row) =>
    mapEnquiryRow(
      row,
      (imagesByEnquiry[row.id] ?? []).map((image) => signedUrls[image.storage_path]).filter((url): url is string => Boolean(url)),
    ),
  );
}

export async function updateEnquiryStatus(client: SupabaseClient, enquiry: Enquiry, next: Status): Promise<void> {
  assertValidTransition(enquiry.status, next);
  const { error } = await client.from('enquiries').update({ status: next }).eq('id', enquiry.id);
  if (error) throw new Error(`Could not update the enquiry: ${error.message}`);
}
