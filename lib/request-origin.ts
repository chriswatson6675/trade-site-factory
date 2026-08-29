// Best-effort request origin for a Server Component, where (unlike a Route
// Handler) there is no NextRequest/request.url to read. Trusts the same
// forwarded headers Vercel's own edge network sets on every request — this
// is only ever used to BUILD a same-origin URL to show/email the owner
// (lib/site-url.ts), never to validate or authorise a redirect target; that
// job stays with lib/safe-redirect.ts, which resolves against the real
// request.url origin it has in a Route Handler.
import { headers } from 'next/headers';

export async function requestOrigin(): Promise<string> {
  const list = await headers();
  const host = list.get('x-forwarded-host') ?? list.get('host') ?? 'localhost:3000';
  const proto = list.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
