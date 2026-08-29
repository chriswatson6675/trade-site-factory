import test from 'node:test';
import assert from 'node:assert/strict';
import { isHoneypotTripped, parseBusinessSlug, parseEnquirySubmission } from '../lib/data/enquiry-validation.ts';

const validBody = () => ({
  businessSlug: 'dee-valley-scaffolding',
  name: 'John Smith',
  mobile: '07700 900456',
  location: 'Chester',
  work: 'Roofing',
  storeys: '2 storeys',
  access: 'Front + side',
  width: '5–10m',
  description: 'Roofers replacing a slate roof.',
  photos: [] as { mimeType: string; size: number }[],
});

test('21 a valid submission parses successfully', () => {
  const result = parseEnquirySubmission(validBody());
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.customerName, 'John Smith');
    assert.equal(result.value.photos.length, 0);
  }
});

test('22 a missing required field is rejected', () => {
  const body = validBody();
  delete (body as Record<string, unknown>).name;
  const result = parseEnquirySubmission(body);
  assert.equal(result.ok, false);
});

test('23 businessSlug is read independently of validation', () => {
  assert.equal(parseBusinessSlug(validBody()), 'dee-valley-scaffolding');
});

test('24 more than 6 photos is rejected', () => {
  const body = validBody();
  body.photos = Array.from({ length: 7 }, () => ({ mimeType: 'image/jpeg', size: 1000 }));
  const result = parseEnquirySubmission(body);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /up to 6 photos/);
});

test('25 a non-image declared mime type is rejected', () => {
  const body = validBody();
  body.photos = [{ mimeType: 'application/pdf', size: 1000 }];
  const result = parseEnquirySubmission(body);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /not an accepted image type/);
});

test('26 a declared size over 10 MB is rejected', () => {
  const body = validBody();
  body.photos = [{ mimeType: 'image/jpeg', size: 10_000_001 }];
  const result = parseEnquirySubmission(body);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /larger than 10 MB/);
});

test('27 valid photo metadata within limits is accepted', () => {
  const body = validBody();
  body.photos = [
    { mimeType: 'image/jpeg', size: 1000 },
    { mimeType: 'image/png', size: 2000 },
  ];
  const result = parseEnquirySubmission(body);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.photos.length, 2);
});

test('58 an over-length field is rejected rather than truncated or silently accepted', () => {
  const body = validBody();
  body.description = 'x'.repeat(4001);
  const result = parseEnquirySubmission(body);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /too long/);
});

test('59 a tripped honeypot field is detected', () => {
  assert.equal(isHoneypotTripped({ website: 'http://spam.example' }), true);
  assert.equal(isHoneypotTripped({ website: '' }), false);
  assert.equal(isHoneypotTripped({}), false);
});

test('60 zero-size or non-finite declared photo size is rejected', () => {
  const body = validBody();
  body.photos = [{ mimeType: 'image/jpeg', size: 0 }];
  const result = parseEnquirySubmission(body);
  assert.equal(result.ok, false);
});
