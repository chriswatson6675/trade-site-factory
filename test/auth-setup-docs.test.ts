// Mission section 7 / 10 K: the documented Supabase hosted email template
// configuration. This can't be verified against the live Supabase project
// from this repo (email templates aren't something any available tool here
// can read or write — see the BUILD-14 final report for the exact manual
// Dashboard action this documents), so this is the next best thing: proving
// the *documented* templates for both Magic Link and Confirm Signup use the
// app's own token_hash callback (app/auth/confirm/route.ts), not Supabase's
// default verify-then-redirect-to-Site-URL behaviour that dropped `next`
// and broke a brand-new owner's very first sign-in.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const authSetup = readFileSync(new URL('../supabase/AUTH_SETUP.md', import.meta.url), 'utf8');

test('150 the documented Magic Link template uses the app token_hash callback with type=email', () => {
  assert.match(authSetup, /<a href="\{\{ \.RedirectTo \}\}&token_hash=\{\{ \.TokenHash \}\}&type=email">/);
});

test('151 the documented Confirm Signup template uses the SAME app token_hash callback shape, with type=signup', () => {
  assert.match(authSetup, /Confirm signup/);
  assert.match(authSetup, /<a href="\{\{ \.RedirectTo \}\}&token_hash=\{\{ \.TokenHash \}\}&type=signup">/);
});

test('152 the docs explain why a brand-new email address needs the Confirm Signup template fixed too, not just Magic Link', () => {
  // Guards against this section silently regressing back to "only Magic
  // Link matters" prose if the file is edited later without re-reading why.
  assert.match(authSetup, /never seen (this Supabase project )?before|brand-new (owner|email)/i);
});

test('153 app/auth/confirm/route.ts verifies whatever `type` the template sends, generically — no separate code path for signup vs magic link', () => {
  const route = readFileSync(new URL('../app/auth/confirm/route.ts', import.meta.url), 'utf8');
  assert.match(route, /searchParams\.get\('type'\)/);
  assert.match(route, /verifyOtp\(\{\s*type,\s*token_hash:\s*tokenHash\s*\}\)/);
  // Not hardcoded to any one EmailOtpType — that's what makes the same
  // route correct for both templates without a code change.
  assert.doesNotMatch(route, /type:\s*'(email|signup|magiclink)'/);
});
