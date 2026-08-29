/**
 * Only ever allow redirecting back to a same-origin, single-leading-slash
 * path. Rejects absolute URLs and protocol-relative paths ("//evil.com")
 * so a crafted `next`/`redirect` query param can never send a signed-in
 * owner off-site — see mission section 25 ("open redirects").
 */
export function safeRedirectPath(value: string | null | undefined, fallback = '/owner'): string {
  if (!value) return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}
