import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEnquiryFormData, readBusinessSlug } from '../lib/data/enquiry-validation.ts';

const validForm = () => {
  const data = new FormData();
  data.set('businessSlug', 'dee-valley-scaffolding');
  data.set('name', 'John Smith');
  data.set('mobile', '07700 900456');
  data.set('location', 'Chester');
  data.set('work', 'Roofing');
  data.set('storeys', '2 storeys');
  data.set('access', 'Front + side');
  data.set('width', '5–10m');
  data.set('description', 'Roofers replacing a slate roof.');
  return data;
};

test('21 valid enquiry form data parses successfully', () => {
  const result = parseEnquiryFormData(validForm());
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.customerName, 'John Smith');
    assert.equal(result.value.photos.length, 0);
  }
});

test('22 missing required field is rejected', () => {
  const data = validForm();
  data.delete('name');
  const result = parseEnquiryFormData(data);
  assert.equal(result.ok, false);
});

test('23 businessSlug is read independently of validation', () => {
  const data = validForm();
  assert.equal(readBusinessSlug(data), 'dee-valley-scaffolding');
});

test('24 more than 6 photos is rejected', () => {
  const data = validForm();
  for (let index = 0; index < 7; index += 1) {
    data.append('photos', new File(['x'], `photo-${index}.jpg`, { type: 'image/jpeg' }));
  }
  const result = parseEnquiryFormData(data);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /up to 6 photos/);
});

test('25 a non-image photo is rejected', () => {
  const data = validForm();
  data.append('photos', new File(['x'], 'document.pdf', { type: 'application/pdf' }));
  const result = parseEnquiryFormData(data);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /not an image/);
});

test('26 an oversized photo is rejected', () => {
  const data = validForm();
  const large = new File([new Uint8Array(10_000_001)], 'big.jpg', { type: 'image/jpeg' });
  data.append('photos', large);
  const result = parseEnquiryFormData(data);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /larger than 10 MB/);
});

test('27 valid photos within limits are accepted', () => {
  const data = validForm();
  data.append('photos', new File(['x'], 'front.jpg', { type: 'image/jpeg' }));
  data.append('photos', new File(['x'], 'side.png', { type: 'image/png' }));
  const result = parseEnquiryFormData(data);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.photos.length, 2);
});
