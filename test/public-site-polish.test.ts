// BUILD-16 (TRADE-SITE-FACTORY-PUBLIC-SITE-POLISH-16). No rendering harness
// in this repo (no jsdom/testing-library — see other test files' own style
// notes), so — consistent with test/migration-grants.test.ts and
// test/owner-dashboard-links.test.ts — these are source-text assertions
// over the real components plus pure-function unit tests, not simulated
// renders.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { businessDescriptor } from '../lib/domain/index.ts';

const publicSite = readFileSync(new URL('../components/public-site.tsx', import.meta.url), 'utf8');
const completionApp = readFileSync(new URL('../components/completion-app.tsx', import.meta.url), 'utf8');
const productionQuoteForm = readFileSync(new URL('../components/production-quote-form.tsx', import.meta.url), 'utf8');
const quoteForm = readFileSync(new URL('../components/quote-form.tsx', import.meta.url), 'utf8');

// A -------------------------------------------------------------------------
test('160 the public header never renders "TRADE WEBSITE"', () => {
  assert.doesNotMatch(publicSite, /TRADE WEBSITE/);
  assert.doesNotMatch(completionApp, /TRADE WEBSITE/);
});

// B -------------------------------------------------------------------------
test('161 businessDescriptor derives a compact trade + location label generically, not hardcoded to any one business', () => {
  assert.equal(businessDescriptor('scaffolding', ['Chester', 'Wrexham', 'Mold'], 'Chester'), 'SCAFFOLDING · Chester & Wrexham');
  // A different trade type produces a different label from the exact same function — proves this isn't Dee-Valley-specific.
  assert.equal(businessDescriptor('roofing', ['Leeds'], 'Leeds'), 'ROOFING · Leeds');
});

test('162 businessDescriptor falls back to town when there are no declared areas, and to just the trade type when there is no location data at all', () => {
  assert.equal(businessDescriptor('scaffolding', [], 'Chester'), 'SCAFFOLDING · Chester');
  assert.equal(businessDescriptor('scaffolding', [], ''), 'SCAFFOLDING');
});

test('163 the public header source passes tradeType, areas and town into businessDescriptor — not a raw/hardcoded string', () => {
  assert.match(publicSite, /businessDescriptor\(business\.tradeType, business\.areas, business\.town\)/);
});

// C / D -----------------------------------------------------------------
test('164 MobileActions defaults to GET A QUOTE (normal public pages) unless quotePage is set', () => {
  const mobileActions = publicSite.slice(publicSite.indexOf('export function MobileActions'), publicSite.indexOf('export function PageChrome'));
  assert.match(mobileActions, /quotePage\s*=\s*false/);
  assert.match(mobileActions, /GET A QUOTE/);
  assert.match(mobileActions, /SEND REQUEST/);
  // Both live inside the same quotePage ? ... : ... branch, not two separate controls.
  assert.match(mobileActions, /quotePage \? <a href="#quote-submit">SEND REQUEST<\/a> : <Link[^>]*>GET A QUOTE<\/Link>/);
});

test('165 only the quote page opts into quotePage — every other public page keeps the default (GET A QUOTE) sticky CTA', () => {
  assert.match(productionQuoteForm, /<PageChrome business=\{business\} quotePage>/);
  // No other component in this file passes quotePage — the quote page is the only opt-in.
  const otherPageChromeUses = [...publicSite.matchAll(/<PageChrome\b[^>]*>/g)];
  for (const use of otherPageChromeUses) {
    assert.doesNotMatch(use[0], /quotePage/);
  }
});

// E -------------------------------------------------------------------------
test('166 SEND REQUEST targets the real submit button by id, with no duplicate submission path', () => {
  assert.match(publicSite, /href="#quote-submit"/);
  assert.match(quoteForm, /<Button type="submit" id="quote-submit"/);
  // The only place a fetch/submit call is made is the form's own onSubmit —
  // MobileActions itself (public-site.tsx) makes no network call at all.
  assert.doesNotMatch(publicSite, /fetch\(/);
  assert.doesNotMatch(publicSite, /onSubmit/);
});

// I / J -----------------------------------------------------------------
test('167 a project with no uploaded image falls back to the neutral ProjectPlaceholder, in both the grid and the detail page', () => {
  const projectCards = publicSite.slice(publicSite.indexOf('export function ProjectCards'), publicSite.indexOf('export function ProjectDetail'));
  assert.match(projectCards, /project\.images\[0\] \? \(/);
  assert.match(projectCards, /<ProjectPlaceholder \/>/);

  const projectDetail = publicSite.slice(publicSite.indexOf('export function ProjectDetail'));
  assert.match(projectDetail, /project\.images\.length \? \(/);
  assert.match(projectDetail, /<ProjectPlaceholder \/>/);
});

test('168 an uploaded image always takes precedence — the <img> branch is checked first, the placeholder only renders in the else branch', () => {
  const projectCards = publicSite.slice(publicSite.indexOf('export function ProjectCards'), publicSite.indexOf('export function ProjectDetail'));
  const imgIndex = projectCards.indexOf('<img');
  const placeholderIndex = projectCards.indexOf('<ProjectPlaceholder');
  assert.ok(imgIndex !== -1 && placeholderIndex !== -1 && imgIndex < placeholderIndex, 'the real <img> must appear before the placeholder fallback in source order');
});

test('169 the project placeholder never claims to be a real photo, and is a genuinely different component from the decorative hero visual', () => {
  const placeholderBody = publicSite.slice(publicSite.indexOf('export function ProjectPlaceholder'), publicSite.indexOf('export function Home'));
  assert.doesNotMatch(placeholderBody, /DEMO PROJECT/);
  assert.match(placeholderBody, /aria-label="No photo added for this project yet"/);

  const heroBody = publicSite.slice(publicSite.indexOf('export function HeroVisual'), publicSite.indexOf('export function ProjectPlaceholder'));
  assert.doesNotMatch(heroBody, /aria-label/); // purely decorative — no caption implying it depicts anything
});

// F / G -----------------------------------------------------------------
test('170 owner-side VIEW MY WEBSITE (dashboard and the post-claim success screen) uses the resolved public URL, never a hardcoded /sites/ path', () => {
  const ownerApp = readFileSync(new URL('../components/owner-app.tsx', import.meta.url), 'utf8');
  const claimSuccess = readFileSync(new URL('../components/owner-claim-success.tsx', import.meta.url), 'utf8');
  assert.match(ownerApp, /href=\{publicSiteUrl\}/);
  assert.match(claimSuccess, /href=\{viewUrl\}/);
});

test('171 owner-side VIEW MY WEBSITE opens in a new tab with safe rel attributes, everywhere it appears', () => {
  const ownerApp = readFileSync(new URL('../components/owner-app.tsx', import.meta.url), 'utf8');
  const claimSuccess = readFileSync(new URL('../components/owner-claim-success.tsx', import.meta.url), 'utf8');
  const viewSiteLink = ownerApp.slice(ownerApp.indexOf('href={publicSiteUrl}') - 40, ownerApp.indexOf('href={publicSiteUrl}') + 80);
  assert.match(viewSiteLink, /target="_blank"/);
  assert.match(viewSiteLink, /rel="noopener noreferrer"/);

  const claimViewLink = claimSuccess.slice(claimSuccess.indexOf('href={viewUrl}') - 40, claimSuccess.indexOf('href={viewUrl}') + 80);
  assert.match(claimViewLink, /target="_blank"/);
  assert.match(claimViewLink, /rel="noopener noreferrer"/);
});

test('172 ordinary customer/public navigation is not switched to open new tabs by this build', () => {
  // The header's "Get a quote" and the sticky CALL/SEND REQUEST/GET A QUOTE
  // controls must stay same-tab; only WHATSAPP (already _blank before this
  // build) and the owner-only VIEW MY WEBSITE controls open a new tab.
  const mobileActions = publicSite.slice(publicSite.indexOf('export function MobileActions'), publicSite.indexOf('export function PageChrome'));
  const callLine = mobileActions.slice(mobileActions.indexOf('CALL') - 80, mobileActions.indexOf('CALL'));
  assert.doesNotMatch(callLine, /target="_blank"/);
  const quoteOrSendLine = mobileActions.slice(mobileActions.indexOf('quotePage ?'));
  assert.doesNotMatch(quoteOrSendLine, /target="_blank"/);
});
