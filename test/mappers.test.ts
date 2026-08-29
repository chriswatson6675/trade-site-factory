import test from 'node:test';
import assert from 'node:assert/strict';
import { filterPublicProjectRows, mapBusinessRow, mapEnquiryRow, mapProjectRow, type ProjectRow } from '../lib/data/mappers.ts';

const row = (overrides: Partial<ProjectRow> = {}): ProjectRow => ({
  id: 'p1',
  business_id: 'biz-1',
  service_name: 'Temporary roof',
  title: 'Temporary Roof Scaffolding',
  slug: 'temporary-roof-scaffolding',
  location: 'Hoole, Chester',
  description: 'Weather protection for a reroof.',
  published: true,
  ...overrides,
});

test('49 published projects for the requested business pass the tenant filter', () => {
  const rows = [row({ id: 'p1' }), row({ id: 'p2', business_id: 'biz-2' })];
  const filtered = filterPublicProjectRows(rows, 'biz-1');
  assert.deepEqual(filtered.map((item) => item.id), ['p1']);
});

test('50 an unpublished project is rejected from the public filter even for the right business', () => {
  const rows = [row({ id: 'draft', published: false })];
  assert.equal(filterPublicProjectRows(rows, 'biz-1').length, 0);
});

test('51 mapProjectRow attaches resolved image URLs without touching other fields', () => {
  const project = mapProjectRow(row(), ['https://cdn.example/a.jpg']);
  assert.equal(project.service, 'Temporary roof');
  assert.deepEqual(project.images, ['https://cdn.example/a.jpg']);
});

test('52 mapProjectRow falls back to "Other" for a null service_name', () => {
  const project = mapProjectRow(row({ service_name: null }), []);
  assert.equal(project.service, 'Other');
});

test('53 mapEnquiryRow renames DB columns to the domain Enquiry shape', () => {
  const enquiry = mapEnquiryRow(
    {
      id: 'e1',
      business_id: 'biz-1',
      reference: 'Q-1001',
      customer_name: 'John Smith',
      mobile: '07700 900456',
      email: null,
      location: 'Chester',
      preferred_contact: 'WhatsApp',
      work_type: 'Roofing',
      storeys: '2 storeys',
      access_areas: 'Front + side',
      width: '5–10m',
      dimensions: null,
      description: 'Roof replacement.',
      status: 'new',
    },
    [],
  );
  assert.equal(enquiry.name, 'John Smith');
  assert.equal(enquiry.work, 'Roofing');
  assert.equal(enquiry.access, 'Front + side');
});

test('54 mapBusinessRow supplies the shared Business shape used across demo and production', () => {
  const business = mapBusinessRow(
    { id: 'biz-1', slug: 'dee-valley-scaffolding', name: 'Dee Valley Scaffolding Ltd', base_town: 'Chester', phone: '01244 555 018', whatsapp: '447700900123', email: null, years_trading: 17 },
    ['Domestic scaffolding'],
    ['Chester'],
  );
  assert.equal(business.town, 'Chester');
  assert.deepEqual(business.services, ['Domestic scaffolding']);
});

test('173 mapBusinessRow maps trade_type to tradeType, and falls back to the schema default when the row omits it', () => {
  const withTradeType = mapBusinessRow(
    { id: 'biz-1', slug: 'roofers-ltd', name: 'Roofers Ltd', base_town: 'Leeds', phone: null, whatsapp: null, email: null, years_trading: null, trade_type: 'roofing' },
    [],
    [],
  );
  assert.equal(withTradeType.tradeType, 'roofing');

  const withoutTradeType = mapBusinessRow(
    { id: 'biz-2', slug: 'dee-valley-scaffolding', name: 'Dee Valley Scaffolding Ltd', base_town: 'Chester', phone: null, whatsapp: null, email: null, years_trading: null },
    [],
    [],
  );
  // Matches businesses.trade_type's own `not null default 'scaffolding'`.
  assert.equal(withoutTradeType.tradeType, 'scaffolding');
});
