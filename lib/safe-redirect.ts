/**
 * Redirect-target validation built on the WHATWG URL parser rather than
 * string-prefix guessing — `new URL()` resolves protocol-relative
 * ("//evil.example") and backslash-normalisation ("/\evil.example", which
 * the spec treats as a path separator for http(s), exactly like a real
 * browser navigation would) tricks the same way a browser does, so
 * comparing the resolved `.origin` catches them all without needing to
 * enumerate every trick by hand.
 */

const PLACEHOLDER_ORIGIN = 'http://safe-redirect.invalid';

/**
 * Resolves `value` against `origin` and returns just its path+search — but
 * only when it actually resolves to that SAME origin. Anything else
 * (a cross-origin absolute URL, a protocol-relative URL, a
 * backslash-normalisation trick, or a value that fails to parse at all)
 * falls back to `fallback`.
 *
 * Pass the real request origin (e.g. `new URL(request.url).origin`) where
 * the value may legitimately be a same-origin *absolute* URL — this is
 * exactly what Supabase's magic-link template hands back as `next` (built
 * from `{{ .RedirectTo }}`, which is whatever this app passed as
 * `emailRedirectTo`) — see app/auth/confirm/route.ts.
 */
export function safeRedirectPath(value: string | null | undefined, origin: string, fallback = '/owner'): string {
  if (!value) return fallback;
  let url: URL;
  try {
    url = new URL(value, origin);
  } catch {
    return fallback;
  }
  if (url.origin !== origin) return fallback;
  return `${url.pathname}${url.search}`;
}

/**
 * Like safeRedirectPath, but rejects *any* input that carries its own
 * scheme/host at all — only a bare relative path+search (e.g.
 * "/owner/claim?token=...") is accepted. Use this wherever the caller
 * doesn't have (or shouldn't need) the real request origin, and the value
 * should never legitimately be absolute — e.g. a `next` query param a
 * visitor could type into their own address bar.
 */
export function safeRelativePath(value: string | null | undefined, fallback = '/owner'): string {
  return safeRedirectPath(value, PLACEHOLDER_ORIGIN, fallback);
}
