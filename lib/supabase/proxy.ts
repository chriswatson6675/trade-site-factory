// Session-refresh helper shared by the root proxy.ts. Keeps the Supabase
// auth cookie fresh on every request so a signed-in owner's session
// survives across page loads without ever needing a password.
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from '../env';
import { shouldRedirectToSignIn } from '../auth-guard';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured) {
    // Demo mode (see lib/data/mode.ts) — nothing to refresh.
    return response;
  }

  const supabase = createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Do not run code between createServerClient and getClaims(): this call
  // is what actually refreshes the session cookie.
  const { data } = await supabase.auth.getClaims();
  const authenticated = Boolean(data?.claims);

  const pathname = request.nextUrl.pathname;
  if (shouldRedirectToSignIn(pathname, authenticated)) {
    // Preserve the FULL intended destination — pathname AND search — so a
    // claim link like /owner/claim?token=... survives the round trip
    // through sign-in. Dropping the query string here was the bug: it
    // silently discarded the claim token (mission section 1).
    const destination = pathname + request.nextUrl.search;
    const url = request.nextUrl.clone();
    url.pathname = '/owner/sign-in';
    url.search = '';
    url.searchParams.set('next', destination);
    return NextResponse.redirect(url);
  }

  return response;
}
