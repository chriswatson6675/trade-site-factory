// Shared production data-layer types. Deliberately structurally identical
// to the demo Business type in lib/data/repository.ts (not imported from
// there, to keep the demo adapter fully self-contained) so the same
// presentational components render either mode without changes.
export type { Enquiry, Project, Status } from '../domain/index.ts';

export type Business = {
  id: string;
  slug: string;
  name: string;
  town: string;
  phone: string;
  whatsapp: string;
  years: number;
  services: string[];
  areas: string[];
  email?: string;
  /** e.g. "scaffolding" — feeds the public header's descriptor (lib/domain's businessDescriptor), never displayed raw/unformatted. */
  tradeType: string;
};
