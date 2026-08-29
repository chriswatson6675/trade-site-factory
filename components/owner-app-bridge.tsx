'use client';
import { useMemo } from 'react';
import { supabaseUrl } from '../lib/env';
import { createSupabaseOwnerAdapter } from '../lib/data/supabase-owner-adapter';
import type { Business, Enquiry, Project } from '../lib/data/types';
import { createClient } from '../lib/supabase/client';
import { OwnerApp } from './owner-app';

type Props = { businessId: string; business: Business; projects: Project[]; enquiries: Enquiry[] };

/** Bridges the server-loaded initial data into a browser Supabase client + OwnerAdapter, since neither can cross the server/client boundary as props. */
export function OwnerAppBridge({ businessId, business, projects, enquiries }: Props) {
  const adapter = useMemo(() => createSupabaseOwnerAdapter(createClient(), businessId, supabaseUrl!), [businessId]);
  return <OwnerApp mode="supabase" adapter={adapter} initialBusiness={business} initialProjects={projects} initialEnquiries={enquiries} />;
}
