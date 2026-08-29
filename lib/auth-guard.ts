// Pure decision logic for lib/supabase/proxy.ts, split out so it's
// unit-testable without constructing real Next.js Request/Response objects.
export function isOwnerRoute(pathname: string): boolean {
  return pathname === '/owner' || pathname.startsWith('/owner/');
}

export function isOwnerAuthExempt(pathname: string): boolean {
  return pathname === '/owner/sign-in' || pathname.startsWith('/auth/');
}

/** True when the request should be redirected to the sign-in screen. */
export function shouldRedirectToSignIn(pathname: string, authenticated: boolean): boolean {
  return isOwnerRoute(pathname) && !isOwnerAuthExempt(pathname) && !authenticated;
}
