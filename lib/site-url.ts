// Pure URL resolution for the three conceptually different links a business
// has (mission section 1 of BUILD-14):
//
//   A. the one-time claim link (/owner/claim?token=...) — built and consumed
//      elsewhere (scripts/create-claim-link.ts, components/claim-redeem.tsx);
//      nothing here ever constructs or returns one.
//   B. the permanent owner/management link — always <origin>/owner.
//   C. the customer-facing website link — <origin>/sites/<slug> today, but
//      resolved through this function so that a future
//      site_configurations.custom_domain rollout is a data change, not a
//      redesign: every call site already asks this function, not the
//      hardcoded path, for the answer.
//
// No I/O here — callers fetch the business slug and custom_domain (if any)
// themselves (see lib/data/welcome-email.ts, app/owner/page.tsx) and pass
// them in, which keeps this trivially unit-testable.

export type SiteConfigForUrl = { customDomain?: string | null } | null | undefined;

/** Permanent owner/management entry point. Never a one-time claim link. */
export function ownerManagementUrl(origin: string): string {
  return `${origin}/owner`;
}

/**
 * Permanent customer-facing website URL. Prefers a configured custom domain
 * when present; otherwise falls back to the shared-site path under `origin`.
 */
export function publicSiteUrl(business: { slug: string }, siteConfig: SiteConfigForUrl, origin: string): string {
  const domain = siteConfig?.customDomain?.trim();
  if (domain) return `https://${domain}`;
  return `${origin}/sites/${business.slug}`;
}
