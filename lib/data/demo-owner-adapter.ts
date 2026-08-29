import { canTransition, slugify, type Project } from '../domain/index.ts';
import type { OwnerAdapter } from './owner-adapter';
import { demoRepository } from './repository';

/** Wraps the existing localStorage-backed demoRepository behind the OwnerAdapter interface — demo behaviour is unchanged. */
export function createDemoOwnerAdapter(): OwnerAdapter {
  return {
    mode: 'demo',
    async saveBusiness(business) {
      demoRepository.saveBusiness(business);
    },
    async publishProject(input) {
      const projects = demoRepository.loadProjects();
      const business = demoRepository.loadBusiness();
      const title = `${input.service} in ${input.location}`;
      const project: Project = {
        id: crypto.randomUUID(),
        businessId: business.id,
        slug: slugify(`${title}-${Date.now()}`),
        title,
        service: input.service,
        location: input.location,
        description: input.description || `Completed ${input.service.toLowerCase()} in ${input.location}.`,
        published: true,
        images: input.photos.map((photo) => photo.url),
      };
      demoRepository.saveProjects([project, ...projects]);
      return project;
    },
    async updateProject(project, input) {
      const projects = demoRepository.loadProjects();
      const updated: Project = {
        ...project,
        service: input.service,
        location: input.location,
        description: input.description,
        images: input.photos.map((photo) => photo.url),
      };
      demoRepository.saveProjects(projects.map((item) => (item.id === project.id ? updated : item)));
      return updated;
    },
    async setProjectPublished(project, published) {
      const projects = demoRepository.loadProjects();
      const updated: Project = { ...project, published };
      demoRepository.saveProjects(projects.map((item) => (item.id === project.id ? updated : item)));
      return updated;
    },
    async deleteProject(project) {
      const projects = demoRepository.loadProjects();
      demoRepository.saveProjects(projects.filter((item) => item.id !== project.id));
    },
    async updateEnquiryStatus(enquiry, status) {
      if (!canTransition(enquiry.status, status)) {
        throw new Error(`Cannot move an enquiry from "${enquiry.status}" to "${status}".`);
      }
      const enquiries = demoRepository.loadEnquiries();
      demoRepository.saveEnquiries(enquiries.map((item) => (item.id === enquiry.id ? { ...item, status } : item)));
    },
  };
}
