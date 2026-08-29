import type { PhotoItem } from '../../components/photo-picker';
import type { Business, Enquiry, Project, Status } from './types';

export type ProjectDraftInput = { service: string; location: string; description: string; photos: PhotoItem[] };
export type ProjectEditInput = { service: string; location: string; description: string; photos: PhotoItem[] };

/**
 * Everything the owner UI (components/owner-app.tsx) needs to persist a
 * change, independent of whether it's backed by localStorage (demo) or
 * Supabase (production) — see lib/data/demo-owner-adapter.ts and
 * lib/data/supabase-owner-adapter.ts.
 */
export interface OwnerAdapter {
  mode: 'demo' | 'supabase';
  saveBusiness(business: Business): Promise<void>;
  publishProject(input: ProjectDraftInput): Promise<Project>;
  updateProject(project: Project, input: ProjectEditInput): Promise<Project>;
  setProjectPublished(project: Project, published: boolean): Promise<Project>;
  deleteProject(project: Project): Promise<void>;
  updateEnquiryStatus(enquiry: Enquiry, status: Status): Promise<void>;
}
