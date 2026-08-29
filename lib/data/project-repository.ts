import type { SupabaseClient } from '@supabase/supabase-js';
import { slugify } from '../domain/index.ts';
import { filterPublicProjectRows, mapProjectRow, type ProjectRow } from './mappers.ts';
import { removeProjectImages, signedProjectImageUrls, uploadProjectImage } from './storage-service.ts';
import type { Project } from './types';

type ImageRow = { id: string; project_id: string; storage_path: string; sort_order: number };

async function imagesByProject(client: SupabaseClient, projectIds: string[]): Promise<Record<string, ImageRow[]>> {
  if (projectIds.length === 0) return {};
  const { data, error } = await client.from('project_images').select('*').in('project_id', projectIds).order('sort_order');
  if (error) throw new Error(`Could not load job photos: ${error.message}`);
  const byProject: Record<string, ImageRow[]> = {};
  ((data ?? []) as ImageRow[]).forEach((row) => {
    (byProject[row.project_id] ??= []).push(row);
  });
  return byProject;
}

/** project-images is a private bucket — every read (public site or owner dashboard) resolves through a short-lived signed URL, never a bucket-public URL. */
async function toProjects(client: SupabaseClient, rows: ProjectRow[], imagesByProjectId: Record<string, ImageRow[]>): Promise<Project[]> {
  const allPaths = Object.values(imagesByProjectId).flat().map((image) => image.storage_path);
  const signedUrls = await signedProjectImageUrls(client, allPaths);
  return rows.map((row) =>
    mapProjectRow(
      row,
      (imagesByProjectId[row.id] ?? []).map((image) => signedUrls[image.storage_path]).filter((url): url is string => Boolean(url)),
    ),
  );
}

async function toProject(client: SupabaseClient, row: ProjectRow, images: ImageRow[]): Promise<Project> {
  const [project] = await toProjects(client, [row], { [row.id]: images });
  return project;
}

export async function getPublicProjects(client: SupabaseClient, businessId: string): Promise<Project[]> {
  const { data, error } = await client
    .from('projects')
    .select('*')
    .eq('business_id', businessId)
    .eq('published', true)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Could not load projects: ${error.message}`);
  const rows = filterPublicProjectRows((data ?? []) as ProjectRow[], businessId);
  const images = await imagesByProject(client, rows.map((row) => row.id));
  return toProjects(client, rows, images);
}

export async function getPublicProjectBySlug(client: SupabaseClient, businessId: string, slug: string): Promise<Project | null> {
  const { data, error } = await client
    .from('projects')
    .select('*')
    .eq('business_id', businessId)
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  if (error) throw new Error(`Could not load job: ${error.message}`);
  if (!data) return null;
  const images = await imagesByProject(client, [data.id]);
  return toProject(client, data as ProjectRow, images[data.id] ?? []);
}

/** Relies on RLS ("owner can manage own projects") for tenant scoping. */
export async function getOwnerProjects(client: SupabaseClient, businessId: string): Promise<Project[]> {
  const { data, error } = await client.from('projects').select('*').eq('business_id', businessId).order('created_at', { ascending: false });
  if (error) throw new Error(`Could not load jobs: ${error.message}`);
  const rows = (data ?? []) as ProjectRow[];
  const images = await imagesByProject(client, rows.map((row) => row.id));
  return toProjects(client, rows, images);
}

export type ProjectDraft = { service: string; location: string; description: string; files: File[] };

export async function publishProject(client: SupabaseClient, businessId: string, draft: ProjectDraft): Promise<Project> {
  const projectId = crypto.randomUUID();
  const title = `${draft.service} in ${draft.location}`;
  const slug = slugify(`${title}-${Date.now()}`);
  const paths = await Promise.all(draft.files.map((file) => uploadProjectImage(client, businessId, projectId, file)));

  const { data, error } = await client
    .from('projects')
    .insert({
      id: projectId,
      business_id: businessId,
      service_name: draft.service,
      title,
      slug,
      location: draft.location,
      description: draft.description || `Completed ${draft.service.toLowerCase()} in ${draft.location}.`,
      published: true,
    })
    .select('*')
    .single();
  if (error) throw new Error(`Could not publish job: ${error.message}`);

  if (paths.length > 0) {
    const { error: imagesError } = await client
      .from('project_images')
      .insert(paths.map((storage_path, index) => ({ project_id: projectId, business_id: businessId, storage_path, sort_order: index })));
    if (imagesError) throw new Error(`Job was published but photos could not be saved: ${imagesError.message}`);
  }

  return toProject(
    client,
    data as ProjectRow,
    paths.map((storage_path, index) => ({ id: '', project_id: projectId, storage_path, sort_order: index })),
  );
}

export type ProjectUpdate = {
  service?: string;
  location?: string;
  description?: string;
  published?: boolean;
  addFiles?: File[];
  removeImagePaths?: string[];
};

export async function updateProject(client: SupabaseClient, businessId: string, project: Project, update: ProjectUpdate): Promise<Project> {
  const changes: Record<string, unknown> = {};
  if (update.service !== undefined) changes.service_name = update.service;
  if (update.location !== undefined) changes.location = update.location;
  if (update.description !== undefined) changes.description = update.description;
  if (update.published !== undefined) changes.published = update.published;
  if (Object.keys(changes).length > 0) {
    const { error } = await client.from('projects').update(changes).eq('id', project.id);
    if (error) throw new Error(`Could not save job: ${error.message}`);
  }

  if (update.removeImagePaths && update.removeImagePaths.length > 0) {
    const { error: deleteError } = await client
      .from('project_images')
      .delete()
      .eq('project_id', project.id)
      .in('storage_path', update.removeImagePaths);
    if (deleteError) throw new Error(`Could not remove photos: ${deleteError.message}`);
    await removeProjectImages(client, update.removeImagePaths);
  }

  if (update.addFiles && update.addFiles.length > 0) {
    const paths = await Promise.all(update.addFiles.map((file) => uploadProjectImage(client, businessId, project.id, file)));
    const { data: last } = await client
      .from('project_images')
      .select('sort_order')
      .eq('project_id', project.id)
      .order('sort_order', { ascending: false })
      .limit(1);
    const startOrder = last && last[0] ? (last[0] as { sort_order: number }).sort_order + 1 : 0;
    const { error: insertError } = await client
      .from('project_images')
      .insert(paths.map((storage_path, index) => ({ project_id: project.id, business_id: businessId, storage_path, sort_order: startOrder + index })));
    if (insertError) throw new Error(`Could not save new photos: ${insertError.message}`);
  }

  const { data, error } = await client.from('projects').select('*').eq('id', project.id).single();
  if (error) throw new Error(`Could not reload job: ${error.message}`);
  const images = await imagesByProject(client, [project.id]);
  return toProject(client, data as ProjectRow, images[project.id] ?? []);
}

/** Deletes the project row (cascades project_images) and best-effort cleans up its Storage objects — mission section 17. */
export async function deleteProject(client: SupabaseClient, projectId: string): Promise<void> {
  const { data: images, error: imagesError } = await client.from('project_images').select('storage_path').eq('project_id', projectId);
  if (imagesError) throw new Error(`Could not load job photos: ${imagesError.message}`);
  const paths = ((images ?? []) as { storage_path: string }[]).map((row) => row.storage_path);

  const { error } = await client.from('projects').delete().eq('id', projectId);
  if (error) throw new Error(`Could not delete job: ${error.message}`);

  await removeProjectImages(client, paths);
}
