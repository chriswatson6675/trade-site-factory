// Mission section 11: a pure model of the full claim redirect chain, built
// from the SAME helper functions the real routes use (lib/auth-guard.ts,
// lib/safe-redirect.ts) so this test actually exercises the production
// logic, not a reimplementation of it. What it doesn't (and can't, without
// a live Supabase project) cover: the real proxy.ts request/response
// plumbing, verifyOtp() itself, or Supabase actually rendering the Magic
// Link template — see supabase/AUTH_SETUP.md for the exact template text
// this simulation assumes is configured.
import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldRedirectToSignIn } from '../lib/auth-guard.ts';
import { safeRedirectPath, safeRelativePath } from '../lib/safe-redirect.ts';

const ORIGIN = 'https://mysite.example';

function simulateClaimJourney(startPath: string) {
  // 1. Unauthenticated visit — proxy.ts's redirect-to-sign-in decision.
  const startUrl = new URL(startPath, ORIGIN);
  if (!shouldRedirectToSignIn(startUrl.pathname, false)) {
    throw new Error('expected this scenario to require sign-in');
  }
  // proxy.ts's fix (mission section 1): preserve pathname + search, not pathname alone.
  const destination = startUrl.pathname + startUrl.search;
  const signInUrl = new URL('/owner/sign-in', ORIGIN);
  signInUrl.searchParams.set('next', destination);

  // 2. app/owner/sign-in/page.tsx reads `next`.
  const nextFromSignInPage = safeRelativePath(signInUrl.searchParams.get('next'));

  // 3. components/sign-in-form.tsx builds emailRedirectTo.
  const emailRedirectTo = `${ORIGIN}/auth/confirm?next=${encodeURIComponent(nextFromSignInPage)}`;

  // 4. The actual magic link the customer receives, per the documented
  // template `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`
  // (supabase/AUTH_SETUP.md) — RedirectTo === emailRedirectTo.
  const magicLinkUrl = new URL(`${emailRedirectTo}&token_hash=fake-token-hash&type=email`);

  // 5. app/auth/confirm/route.ts, after a successful verifyOtp.
  const finalRedirect = safeRedirectPath(magicLinkUrl.searchParams.get('next'), ORIGIN);

  return { destination, magicLinkUrl, finalRedirect };
}

test('107 the full claim journey preserves the claim token end to end', () => {
  const { finalRedirect } = simulateClaimJourney('/owner/claim?token=secret123');
  assert.equal(finalRedirect, '/owner/claim?token=secret123');
});

test('108 the magic link is one well-formed URL carrying next, token_hash and type together', () => {
  const { magicLinkUrl } = simulateClaimJourney('/owner/claim?token=secret123');
  assert.equal(magicLinkUrl.pathname, '/auth/confirm');
  assert.equal(magicLinkUrl.searchParams.get('next'), '/owner/claim?token=secret123');
  assert.equal(magicLinkUrl.searchParams.get('token_hash'), 'fake-token-hash');
  assert.equal(magicLinkUrl.searchParams.get('type'), 'email');
});

test('109 a plain /owner sign-in with no claim round-trips just as cleanly', () => {
  const { finalRedirect } = simulateClaimJourney('/owner');
  assert.equal(finalRedirect, '/owner');
});

test('110 a claim token with special characters survives the full round trip', () => {
  const token = encodeURIComponent('abc+def/ghi');
  const { finalRedirect } = simulateClaimJourney(`/owner/claim?token=${token}`);
  assert.equal(new URL(finalRedirect, ORIGIN).searchParams.get('token'), 'abc+def/ghi');
});

test('111 the intended destination is present at every hop of the chain, not just the start and end', () => {
  const { destination, magicLinkUrl, finalRedirect } = simulateClaimJourney('/owner/claim?token=secret123');
  assert.equal(destination, '/owner/claim?token=secret123');
  assert.equal(magicLinkUrl.searchParams.get('next'), '/owner/claim?token=secret123');
  assert.equal(finalRedirect, '/owner/claim?token=secret123');
});

test('112 an already-authenticated visit to /owner/claim is never sent through sign-in at all', () => {
  assert.equal(shouldRedirectToSignIn('/owner/claim', true), false);
});
