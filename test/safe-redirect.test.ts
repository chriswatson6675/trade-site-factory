import test from 'node:test';
import assert from 'node:assert/strict';
import { safeRedirectPath, safeRelativePath } from '../lib/safe-redirect.ts';

const ORIGIN = 'https://mysite.example';

// Exact accept cases from mission section 2 -------------------------------
test('95 /owner is accepted and returned unchanged', () => {
  assert.equal(safeRedirectPath('/owner', ORIGIN), '/owner');
  assert.equal(safeRelativePath('/owner'), '/owner');
});

test('96 /owner/claim?token=abc is accepted with its query string intact', () => {
  assert.equal(safeRedirectPath('/owner/claim?token=abc', ORIGIN), '/owner/claim?token=abc');
  assert.equal(safeRelativePath('/owner/claim?token=abc'), '/owner/claim?token=abc');
});

test('97 /owner?x=1 is accepted', () => {
  assert.equal(safeRedirectPath('/owner?x=1', ORIGIN), '/owner?x=1');
  assert.equal(safeRelativePath('/owner?x=1'), '/owner?x=1');
});

// Exact reject cases from mission section 2 -------------------------------
test('98 an absolute cross-origin URL is rejected', () => {
  assert.equal(safeRedirectPath('https://evil.example', ORIGIN), '/owner');
  assert.equal(safeRelativePath('https://evil.example'), '/owner');
});

test('99 a protocol-relative URL is rejected', () => {
  assert.equal(safeRedirectPath('//evil.example', ORIGIN), '/owner');
  assert.equal(safeRelativePath('//evil.example'), '/owner');
});

test('100 a backslash-normalisation trick is rejected (WHATWG URL treats \\ as a path separator for http(s), exactly like a real navigation)', () => {
  assert.equal(safeRedirectPath('/\\evil.example', ORIGIN), '/owner');
  assert.equal(safeRelativePath('/\\evil.example'), '/owner');
});

test('101 other malformed/cross-origin forms are rejected', () => {
  assert.equal(safeRedirectPath('http:evil.example', ORIGIN), '/owner'); // opaque-path trick
  assert.equal(safeRedirectPath('javascript:alert(1)', ORIGIN), '/owner'); // non-http scheme
  assert.equal(safeRedirectPath('https://mysite.example.evil.example', ORIGIN), '/owner'); // lookalike host
  assert.equal(safeRedirectPath('https://attacker.example/mysite.example', ORIGIN), '/owner'); // lookalike path
  assert.equal(safeRedirectPath('', ORIGIN), '/owner'); // empty
});

// safeRedirectPath's extra capability over safeRelativePath ----------------
test('102 safeRedirectPath additionally accepts a same-origin ABSOLUTE URL (what Supabase\'s {{ .RedirectTo }} provides)', () => {
  assert.equal(safeRedirectPath('https://mysite.example/owner/claim?token=abc', ORIGIN), '/owner/claim?token=abc');
});

test('103 safeRelativePath rejects that same same-origin absolute form — it must be a bare relative path', () => {
  assert.equal(safeRelativePath('https://mysite.example/owner/claim?token=abc'), '/owner');
});

test('104 a custom fallback is honoured', () => {
  assert.equal(safeRedirectPath('https://evil.example', ORIGIN, '/somewhere-else'), '/somewhere-else');
});

test('105 URL-encoded query values (e.g. a claim token) round-trip correctly', () => {
  const encoded = '/owner/claim?token=' + encodeURIComponent('abc/def+ghi=jkl');
  const result = safeRedirectPath(encoded, ORIGIN);
  assert.equal(new URL(result, ORIGIN).searchParams.get('token'), 'abc/def+ghi=jkl');
});
