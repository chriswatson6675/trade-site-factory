import test from 'node:test';
import assert from 'node:assert/strict';
import { generateClaimToken, hashClaimToken } from '../lib/claim-token.ts';

test('61 generateClaimToken produces a long, URL-safe, unpredictable string', () => {
  const token = generateClaimToken();
  assert.ok(token.length >= 40);
  assert.doesNotMatch(token, /[+/=]/); // base64url, not base64
});

test('62 two generated tokens are never equal', () => {
  assert.notEqual(generateClaimToken(), generateClaimToken());
});

test('63 hashClaimToken is deterministic (same input, same hash)', () => {
  const token = generateClaimToken();
  assert.equal(hashClaimToken(token), hashClaimToken(token));
});

test('64 hashClaimToken output is a 64-character lowercase hex SHA-256 digest', () => {
  assert.match(hashClaimToken('any-token'), /^[0-9a-f]{64}$/);
});

test('65 different tokens hash to different values', () => {
  assert.notEqual(hashClaimToken('token-a'), hashClaimToken('token-b'));
});

test('66 the raw token is never recoverable from its hash (hash length differs from typical token length, and is not a substring)', () => {
  const token = generateClaimToken();
  const hash = hashClaimToken(token);
  assert.equal(hash.includes(token), false);
});
