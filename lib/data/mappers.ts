// Pure row → domain mappers. Kept free of any Supabase client/network call
// so they're trivial to unit test with plain fixture objects.
import type { Business, Enquiry, Project, Status } from './types';

export type ProjectRow = {
  id: string;
  business_id: string;
  service_name: string | null;
  title: string;
  slug: string;
  location: string;
  description: string;
  published: boolean;
};

export const mapProjectRow = (row: ProjectRow, images: string[]): Project => ({
  id: row.id,
  businessId: row.business_id,
  slug: row.slug,
  title: row.title,
  service: row.service_name ?? 'Other',
  location: row.location,
  description: row.description,
  published: row.published,
  images,
});

export type EnquiryRow = {
  id: string;
  business_id: string;
  reference: string;
  customer_name: string;
  mobile: string;
  email: string | null;
  location: string;
  preferred_contact: string | null;
  work_type: string;
  storeys: string;
  access_areas: string;
  width: string;
  dimensions: string | null;
  description: string;
  status: Status;
};

export const mapEnquiryRow = (row: EnquiryRow, photos: string[]): Enquiry => ({
  id: row.id,
  businessId: row.business_id,
  reference: row.reference,
  name: row.customer_name,
  mobile: row.mobile,
  email: row.email ?? undefined,
  location: row.location,
  preferredContact: row.preferred_contact ?? undefined,
  work: row.work_type,
  storeys: row.storeys,
  access: row.access_areas,
  width: row.width,
  dimensions: row.dimensions ?? undefined,
  description: row.description,
  photos,
  status: row.status,
});

export type BusinessRow = {
  id: string;
  slug: string;
  name: string;
  base_town: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  years_trading: number | null;
};

export const mapBusinessRow = (row: BusinessRow, services: string[], areas: string[]): Business => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  town: row.base_town ?? '',
  phone: row.phone ?? '',
  whatsapp: row.whatsapp ?? '',
  years: row.years_trading ?? 0,
  services,
  areas,
  email: row.email ?? undefined,
});

/** Public visitors only ever see published projects belonging to the requested business — defense in depth alongside RLS. */
export const filterPublicProjectRows = (rows: ProjectRow[], businessId: string): ProjectRow[] =>
  rows.filter((row) => row.business_id === businessId && row.published);
