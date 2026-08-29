import { notFound } from 'next/navigation';
import { getPublishedBusinessBySlug } from './business-repository';
import { getPublicProjects } from './project-repository';
import type { Business, Project } from './types';
import { createClient } from '../supabase/server';

/** Shared by every app/sites/[businessSlug]/... route — loads the published business (404s if missing/unpublished) plus its published projects. */
export async function loadPublicSite(businessSlug: string): Promise<{ business: Business; projects: Project[] }> {
  const supabase = await createClient();
  const business = await getPublishedBusinessBySlug(supabase, businessSlug);
  if (!business) notFound();
  const projects = await getPublicProjects(supabase, business.id);
  return { business, projects };
}
