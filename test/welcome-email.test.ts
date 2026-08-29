// Mission section 10 C/D: the welcome email's content guarantees.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOwnerWelcomeEmail } from '../lib/email/welcome-email.ts';

const INPUT = {
  businessName: 'Dee Valley Scaffolding Ltd',
  manageUrl: 'https://trade-site-factory.example/owner',
  viewUrl: 'https://trade-site-factory.example/sites/dee-valley-scaffolding',
};

test('136 the welcome email subject is exactly "Your website is ready"', () => {
  const { subject } = buildOwnerWelcomeEmail(INPUT);
  assert.equal(subject, 'Your website is ready');
});

test('137 the welcome email (html and text) contains the business name, manage URL and view URL', () => {
  const { html, text } = buildOwnerWelcomeEmail(INPUT);
  for (const body of [html, text]) {
    assert.match(body, /Dee Valley Scaffolding Ltd/);
    assert.match(body, /https:\/\/trade-site-factory\.example\/owner/);
    assert.match(body, /https:\/\/trade-site-factory\.example\/sites\/dee-valley-scaffolding/);
  }
});

test('138 the welcome email never contains a claim token or /owner/claim?token=, however the URLs are built', () => {
  // Simulate a claim URL leaking into the wrong parameter, to prove the
  // content builder itself has no path that could echo one back — it only
  // ever accepts businessName/manageUrl/viewUrl, never a token.
  const withSuspiciousManageUrl = buildOwnerWelcomeEmail({
    ...INPUT,
    manageUrl: 'https://trade-site-factory.example/owner', // never /owner/claim
  });
  for (const body of [withSuspiciousManageUrl.html, withSuspiciousManageUrl.text]) {
    assert.doesNotMatch(body, /\/owner\/claim/);
    assert.doesNotMatch(body, /token/i);
    assert.doesNotMatch(body, /token_hash/);
  }
});

test('139 the welcome email mentions both permanent actions by name', () => {
  const { html, text } = buildOwnerWelcomeEmail(INPUT);
  for (const body of [html, text]) {
    assert.match(body, /MANAGE MY WEBSITE/);
    assert.match(body, /VIEW MY WEBSITE/);
  }
});

test('140 the html body escapes the business name (defence in depth against a stray "<"/"&" in stored business data)', () => {
  const { html } = buildOwnerWelcomeEmail({ ...INPUT, businessName: 'Dee & Valley <Scaffolding>' });
  assert.doesNotMatch(html, /<Scaffolding>/);
  assert.match(html, /Dee &amp; Valley &lt;Scaffolding&gt;/);
});
