import test from 'node:test';
import assert from 'node:assert/strict';
import { isOwnerAuthExempt, isOwnerRoute, shouldRedirectToSignIn } from '../lib/auth-guard.ts';

test('39 unauthenticated visitor to /owner is redirected to sign-in', () => {
  assert.equal(shouldRedirectToSignIn('/owner', false), true);
});

test('40 unauthenticated visitor to a nested /owner path is redirected', () => {
  assert.equal(shouldRedirectToSignIn('/owner/jobs', false), true);
});

test('41 authenticated visitor to /owner is not redirected', () => {
  assert.equal(shouldRedirectToSignIn('/owner', true), false);
});

test('42 the sign-in page itself is never redirected, even unauthenticated', () => {
  assert.equal(shouldRedirectToSignIn('/owner/sign-in', false), false);
});

test('43 auth callback routes are exempt from the guard', () => {
  assert.equal(isOwnerAuthExempt('/auth/confirm'), true);
  assert.equal(shouldRedirectToSignIn('/auth/confirm', false), false);
});

test('44 public site routes are not owner routes', () => {
  assert.equal(isOwnerRoute('/sites/dee-valley-scaffolding'), false);
  assert.equal(shouldRedirectToSignIn('/sites/dee-valley-scaffolding', false), false);
});

test('45 a path that merely contains "owner" elsewhere is not treated as an owner route', () => {
  assert.equal(isOwnerRoute('/sites/owner-builders-ltd'), false);
});
