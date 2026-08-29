import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSecureToken, hashSecureToken } from '../lib/secure-token.ts';

test('61 generateSecureToken produces a long, URL-safe, unpredictable string', () => {
  const token = generateSecureToken();
  assert.ok(token.length >= 40);
  assert.doesNotMatch(token, /[+/=]/); // base64url, not base64
});

test('62 two generated tokens are never equal', () => {
  assert.notEqual(generateSecureToken(), generateSecureToken());
});

test('63 hashSecureToken is deterministic (same input, same hash)', () => {
  const token = generateSecureToken();
  assert.equal(hashSecureToken(token), hashSecureToken(token));
});

test('64 hashSecureToken output is a 64-character lowercase hex SHA-256 digest', () => {
  assert.match(hashSecureToken('any-token'), /^[0-9a-f]{64}$/);
});

test('65 different tokens hash to different values', () => {
  assert.notEqual(hashSecureToken('token-a'), hashSecureToken('token-b'));
});

test('66 the raw token is never recoverable from its hash (hash length differs from typical token length, and is not a substring)', () => {
  const token = generateSecureToken();
  const hash = hashSecureToken(token);
  assert.equal(hash.includes(token), false);
});

test('106 hashSecureToken matches a known SHA-256 test vector', () => {
  // sha256("") is a well-known constant — pins the algorithm, not just internal consistency.
  assert.equal(hashSecureToken(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});
