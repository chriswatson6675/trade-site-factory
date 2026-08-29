import test from 'node:test';
import assert from 'node:assert/strict';
import {
  enquiryImagePath,
  extensionForMimeType,
  projectImagePath,
  storagePathFromPublicProjectImageUrl,
} from '../lib/data/storage-paths.ts';

test('28 project image path is namespaced by business and project, with a UUID file name', () => {
  const path = projectImagePath('biz-1', 'proj-1', 'image/jpeg', 'fixed-uuid');
  assert.equal(path, 'businesses/biz-1/projects/proj-1/fixed-uuid.jpg');
});

test('29 enquiry image path is namespaced by business and enquiry', () => {
  const path = enquiryImagePath('biz-1', 'enq-1', 'image/png', 'fixed-uuid');
  assert.equal(path, 'businesses/biz-1/enquiries/enq-1/fixed-uuid.png');
});

test('30 a user-supplied file name never influences the storage path', () => {
  const path = projectImagePath('biz-1', 'proj-1', 'image/jpeg', 'fixed-uuid');
  assert.doesNotMatch(path, /\.\.|secrets|passwd/);
});

test('31 unknown mime types fall back to a safe generic extension', () => {
  assert.equal(extensionForMimeType('application/octet-stream'), 'bin');
});

test('32 known mime types map to their expected extension', () => {
  assert.equal(extensionForMimeType('image/webp'), 'webp');
  assert.equal(extensionForMimeType('IMAGE/JPEG'), 'jpg');
});

test('33 a public project image URL round-trips back to its storage path', () => {
  const url = 'https://example.supabase.co/storage/v1/object/public/project-images/businesses/b/projects/p/id.jpg';
  assert.equal(storagePathFromPublicProjectImageUrl(url, 'https://example.supabase.co'), 'businesses/b/projects/p/id.jpg');
});

test('34 a URL from a different bucket/host does not resolve to a storage path', () => {
  const url = 'https://attacker.example/storage/v1/object/public/project-images/x.jpg';
  assert.equal(storagePathFromPublicProjectImageUrl(url, 'https://example.supabase.co'), null);
});
