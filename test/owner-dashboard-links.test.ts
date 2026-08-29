// Mission section 6 (J): /owner must expose an obvious, working public-site
// link, and must never render the one-time claim link. There's no rendering
// harness in this repo (no jsdom/testing-library — see the other test
// files' own style notes), so — consistent with test/migration-grants.test.ts
// and test/auth-setup-docs.test.ts — this is a source-text assertion over
// the actual component, not a simulated render.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ownerApp = readFileSync(new URL('../components/owner-app.tsx', import.meta.url), 'utf8');
const claimRedeem = readFileSync(new URL('../components/claim-redeem.tsx', import.meta.url), 'utf8');
const ownerPageServer = readFileSync(new URL('../app/owner/page.tsx', import.meta.url), 'utf8');

test('155 the owner dashboard has an obvious "VIEW MY WEBSITE" control on every view, not just the home screen', () => {
  assert.match(ownerApp, /VIEW MY WEBSITE/);
  // It must render on the shared page wrapper used by every /owner view
  // (home, add, jobs, edit, details, enquiries, live) — not gated to one.
  const wrapperBody = ownerApp.slice(ownerApp.indexOf('function OwnerPage('));
  assert.match(wrapperBody, /VIEW MY WEBSITE/);
});

test('156 the dashboard\'s public-site link uses the resolved publicSiteUrl prop, never a hardcoded /sites/<slug> path', () => {
  // The one hardcoded /sites/ path allowed to remain is the specific
  // just-published PROJECT page after "PUBLISH JOB" (not the business
  // homepage link this test is about) — assert there's exactly that one.
  const hardcodedSitePaths = [...ownerApp.matchAll(/href=\{`\/sites\/\$\{business\.slug\}[^`]*`\}/g)];
  assert.equal(hardcodedSitePaths.length, 1, 'expected only the published-project link to still build its own /sites/ path');
  assert.match(hardcodedSitePaths[0][0], /projects\/\$\{selected\.slug\}/);

  assert.match(ownerApp, /href=\{publicSiteUrl\}/);
});

test('157 /owner never renders the one-time claim link/token anywhere', () => {
  for (const source of [ownerApp, ownerPageServer]) {
    assert.doesNotMatch(source, /\/owner\/claim/);
    assert.doesNotMatch(source, /token_hash/);
  }
});

test('158 the claim redemption flow hands off to /owner\'s success screen, not the one-time claim link, once redeemed', () => {
  assert.match(claimRedeem, /router\.replace\('\/owner\?claimed=1'\)/);
});
