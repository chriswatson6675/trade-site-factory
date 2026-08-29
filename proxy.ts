// Next.js request proxy (the successor to middleware.ts — see
// https://nextjs.org/docs/messages/middleware-to-proxy). Refreshes the
// Supabase session cookie and gates production /owner access, per
// lib/supabase/proxy.ts.
import type { NextRequest } from 'next/server';
import { updateSession } from './lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
