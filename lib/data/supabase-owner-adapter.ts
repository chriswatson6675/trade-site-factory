import type { SupabaseClient } from '@supabase/supabase-js';
import { updateBusinessAreas, updateBusinessDetails, updateBusinessServices } from './business-repository';
import { updateEnquiryStatus as updateEnquiryStatusRow } from './enquiry-repository';
import type { OwnerAdapter } from './owner-adapter';
import { deleteProject as deleteProjectRow, publishProject as publishProjectRow, updateProject as updateProjectRow } from './project-repository';
import { storagePathFromSignedProjectImageUrl } from './storage-paths';

/** Real, Supabase-backed OwnerAdapter — every write is scoped to `businessId` and enforced again by RLS server-side. */
export function createSupabaseOwnerAdapter(client: SupabaseClient, businessId: string, supabaseUrl: string): OwnerAdapter {
  return {
    mode: 'supabase',
    async saveBusiness(business) {
      await updateBusinessDetails(client, businessId, {
        name: business.name,
        phone: business.phone,
        whatsapp: business.whatsapp,
        email: business.email,
        town: business.town,
        years: business.years,
      });
      await updateBusinessServices(client, businessId, business.services);
      await updateBusinessAreas(client, businessId, business.areas);
    },
    async publishProject(input) {
      const files = input.photos.filter((photo) => photo.file).map((photo) => photo.file!);
      return publishProjectRow(client, businessId, { service: input.service, location: input.location, description: input.description, files });
    },
    async updateProject(project, input) {
      const keptUrls = new Set(input.photos.filter((photo) => !photo.file).map((photo) => photo.url));
      const removedUrls = project.images.filter((url) => !keptUrls.has(url));
      const removeImagePaths = removedUrls
        .map((url) => storagePathFromSignedProjectImageUrl(url, supabaseUrl))
        .filter((path): path is string => Boolean(path));
      const addFiles = input.photos.filter((photo) => photo.file).map((photo) => photo.file!);
      return updateProjectRow(client, businessId, project, {
        service: input.service,
        location: input.location,
        description: input.description,
        addFiles,
        removeImagePaths,
      });
    },
    async setProjectPublished(project, published) {
      return updateProjectRow(client, businessId, project, { published });
    },
    async deleteProject(project) {
      await deleteProjectRow(client, project.id);
    },
    async updateEnquiryStatus(enquiry, status) {
      await updateEnquiryStatusRow(client, enquiry, status);
    },
  };
}
