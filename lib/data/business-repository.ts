import type { SupabaseClient } from '@supabase/supabase-js';
import { slugify } from '../domain/index.ts';
import { mapBusinessRow, type BusinessRow } from './mappers';
import type { Business } from './types';

type BusinessServiceJoinRow = { services: { name: string } | { name: string }[] | null };

async function servicesAndAreas(client: SupabaseClient, businessId: string) {
  const [servicesResult, areasResult] = await Promise.all([
    client.from('business_services').select('services(name)').eq('business_id', businessId),
    client.from('service_areas').select('name').eq('business_id', businessId).order('name'),
  ]);
  if (servicesResult.error) throw new Error(`Could not load services: ${servicesResult.error.message}`);
  if (areasResult.error) throw new Error(`Could not load areas: ${areasResult.error.message}`);

  const services = ((servicesResult.data ?? []) as BusinessServiceJoinRow[])
    .map((row) => (Array.isArray(row.services) ? row.services[0]?.name : row.services?.name))
    .filter((name): name is string => Boolean(name));
  const areas = ((areasResult.data ?? []) as { name: string }[]).map((row) => row.name);
  return { services, areas };
}

export async function getPublishedBusinessBySlug(client: SupabaseClient, slug: string): Promise<Business | null> {
  const { data, error } = await client.from('businesses').select('*').eq('slug', slug).eq('site_status', 'published').maybeSingle();
  if (error) throw new Error(`Could not load business: ${error.message}`);
  if (!data) return null;
  const { services, areas } = await servicesAndAreas(client, data.id);
  return mapBusinessRow(data as BusinessRow, services, areas);
}

/** Relies on RLS ("owner can read own business") to scope results to the caller's memberships. */
export async function getOwnerBusinesses(client: SupabaseClient): Promise<Business[]> {
  const { data, error } = await client.from('businesses').select('*').order('created_at');
  if (error) throw new Error(`Could not load your business: ${error.message}`);
  const rows = (data ?? []) as BusinessRow[];
  return Promise.all(
    rows.map(async (row) => {
      const { services, areas } = await servicesAndAreas(client, row.id);
      return mapBusinessRow(row, services, areas);
    }),
  );
}

export async function hasAnyMembership(client: SupabaseClient, userId: string): Promise<boolean> {
  const { count, error } = await client
    .from('business_members')
    .select('business_id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw new Error(`Could not check memberships: ${error.message}`);
  return (count ?? 0) > 0;
}

export async function claimBusiness(client: SupabaseClient, slug: string): Promise<void> {
  const { error } = await client.rpc('claim_unclaimed_business', { p_slug: slug });
  if (error) throw new Error(error.message);
}

export type BusinessDetailsUpdate = {
  name?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  town?: string;
  years?: number;
};

export async function updateBusinessDetails(client: SupabaseClient, businessId: string, changes: BusinessDetailsUpdate): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (changes.name !== undefined) patch.name = changes.name;
  if (changes.phone !== undefined) patch.phone = changes.phone;
  if (changes.whatsapp !== undefined) patch.whatsapp = changes.whatsapp;
  if (changes.email !== undefined) patch.email = changes.email;
  if (changes.town !== undefined) patch.base_town = changes.town;
  if (changes.years !== undefined) patch.years_trading = changes.years;
  if (Object.keys(patch).length === 0) return;

  const { error } = await client.from('businesses').update(patch).eq('id', businessId);
  if (error) throw new Error(`Could not save business details: ${error.message}`);
}

/** Replaces the business's selected services with exactly `selected` (delete-all-then-insert; small fixed list, owner-triggered). */
export async function updateBusinessServices(client: SupabaseClient, businessId: string, selected: string[]): Promise<void> {
  const { data: catalogue, error: catalogueError } = await client.from('services').select('id, name').eq('trade_type', 'scaffolding');
  if (catalogueError) throw new Error(`Could not load the service catalogue: ${catalogueError.message}`);
  const ids = ((catalogue ?? []) as { id: string; name: string }[]).filter((row) => selected.includes(row.name)).map((row) => row.id);

  const { error: deleteError } = await client.from('business_services').delete().eq('business_id', businessId);
  if (deleteError) throw new Error(`Could not update services: ${deleteError.message}`);
  if (ids.length > 0) {
    const { error: insertError } = await client.from('business_services').insert(ids.map((service_id) => ({ business_id: businessId, service_id })));
    if (insertError) throw new Error(`Could not update services: ${insertError.message}`);
  }
}

/** Replaces the business's declared service areas with exactly `selected` (delete-all-then-insert). */
export async function updateBusinessAreas(client: SupabaseClient, businessId: string, selected: string[]): Promise<void> {
  const { error: deleteError } = await client.from('service_areas').delete().eq('business_id', businessId);
  if (deleteError) throw new Error(`Could not update areas: ${deleteError.message}`);
  if (selected.length > 0) {
    const { error: insertError } = await client
      .from('service_areas')
      .insert(selected.map((name) => ({ business_id: businessId, name, slug: slugify(name) })));
    if (insertError) throw new Error(`Could not update areas: ${insertError.message}`);
  }
}
