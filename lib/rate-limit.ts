// Clean seam for future abuse controls on anonymous, internet-facing
// routes (currently just POST /api/enquiries and /api/enquiries/confirm).
// Deliberately not implemented yet — the mission is explicit that this
// build should not grow "a giant anti-spam product" — but every call site
// is already wired through this function so adding a real limiter later
// (Upstash Redis + a sliding window, Vercel's own rate limiting, or a
// Cloudflare Turnstile / hCaptcha token check) touches one file, not every
// route.
//
// `key` should identify the thing being limited — e.g. `enquiry:<ip>` or
// `enquiry:<businessSlug>:<ip>`. Always returns `allowed: true` today.
export type RateLimitResult = { allowed: boolean; retryAfterSeconds?: number };

export async function checkRateLimit(key: string): Promise<RateLimitResult> {
  void key; // not yet used — see comment above for the intended real implementation
  return { allowed: true };
}
