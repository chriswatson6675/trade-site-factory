// Mission section 1: three conceptually different links. This covers the
// two that are computed (owner + customer-facing) — the claim link is
// generated/consumed elsewhere (scripts/create-claim-link.ts,
// components/claim-redeem.tsx) and never built by this module.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ownerManagementUrl, publicSiteUrl } from '../lib/site-url.ts';

const ORIGIN = 'https://trade-site-factory-mcat236pc-chriswatson6675s-projects.vercel.app';

test('132 ownerManagementUrl is always <origin>/owner — permanent, never a claim link', () => {
  assert.equal(ownerManagementUrl(ORIGIN), `${ORIGIN}/owner`);
});

test('133 publicSiteUrl falls back to <origin>/sites/<slug> when there is no custom domain', () => {
  assert.equal(publicSiteUrl({ slug: 'dee-valley-scaffolding' }, null, ORIGIN), `${ORIGIN}/sites/dee-valley-scaffolding`);
  assert.equal(publicSiteUrl({ slug: 'dee-valley-scaffolding' }, undefined, ORIGIN), `${ORIGIN}/sites/dee-valley-scaffolding`);
  assert.equal(publicSiteUrl({ slug: 'dee-valley-scaffolding' }, { customDomain: null }, ORIGIN), `${ORIGIN}/sites/dee-valley-scaffolding`);
  assert.equal(publicSiteUrl({ slug: 'dee-valley-scaffolding' }, { customDomain: '' }, ORIGIN), `${ORIGIN}/sites/dee-valley-scaffolding`);
});

test('134 publicSiteUrl prefers a configured custom_domain over the shared-site path', () => {
  assert.equal(publicSiteUrl({ slug: 'dee-valley-scaffolding' }, { customDomain: 'deevalleyscaffolding.co.uk' }, ORIGIN), 'https://deevalleyscaffolding.co.uk');
});

test('135 publicSiteUrl trims whitespace around a stored custom_domain', () => {
  assert.equal(publicSiteUrl({ slug: 'dee-valley-scaffolding' }, { customDomain: '  deevalleyscaffolding.co.uk  ' }, ORIGIN), 'https://deevalleyscaffolding.co.uk');
});
