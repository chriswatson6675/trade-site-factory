// Mission section 10 B/E/F/G: the send-once-and-safely-retry workflow
// (lib/data/welcome-email.ts), against a fake Supabase client covering
// exactly the query-builder shape it calls — same style as
// test/project-repository.test.ts / test/enquiry-submission.test.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureOwnerWelcomeEmailSent } from '../lib/data/welcome-email.ts';
import type { Business } from '../lib/data/types.ts';

const BUSINESS_ID = 'biz-1';
const BUSINESS: Business = {
  id: BUSINESS_ID,
  slug: 'dee-valley-scaffolding',
  name: 'Dee Valley Scaffolding Ltd',
  town: 'Chester',
  phone: '01244 555 018',
  whatsapp: '447700900123',
  years: 17,
  services: [],
  areas: [],
  tradeType: 'scaffolding',
};
const PARAMS = {
  businessId: BUSINESS_ID,
  businessName: BUSINESS.name,
  ownerEmail: 'owner@example.com',
  manageUrl: 'https://trade-site-factory.example/owner',
  viewUrl: 'https://trade-site-factory.example/sites/dee-valley-scaffolding',
};

/** welcomeEmailSentAt: null = never sent yet. rpcCalls records every mark_welcome_email_sent invocation, so tests can assert it was (or wasn't) called. */
function createFakeClient(welcomeEmailSentAt: string | null) {
  const rpcCalls: { fn: string; args: unknown }[] = [];
  const fake = {
    from: (table: string) => {
      if (table === 'business_members') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { welcome_email_sent_at: welcomeEmailSentAt }, error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
    rpc: async (fn: string, args: unknown) => {
      rpcCalls.push({ fn, args });
      return { data: true, error: null };
    },
  };
  return { client: fake as unknown as SupabaseClient, rpcCalls };
}

test('141 a first-ever claim (no membership row sent-marker yet) sends the welcome email and marks it delivered', async () => {
  const { client, rpcCalls } = createFakeClient(null);
  const sent: unknown[] = [];
  const outcome = await ensureOwnerWelcomeEmailSent(client, PARAMS, { sendEmail: async (input) => void sent.push(input) });

  assert.equal(outcome, 'sent');
  assert.equal(sent.length, 1);
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].fn, 'mark_welcome_email_sent');
  assert.deepEqual(rpcCalls[0].args, { p_business_id: BUSINESS_ID });
});

test('142 the sent email contains the business name, owner management URL and customer-facing URL', async () => {
  const { client } = createFakeClient(null);
  const sent: { subject: string; html: string; text: string; to: string }[] = [];
  await ensureOwnerWelcomeEmailSent(client, PARAMS, { sendEmail: async (input) => void sent.push(input as never) });

  assert.equal(sent[0].to, PARAMS.ownerEmail);
  assert.match(sent[0].html, /Dee Valley Scaffolding Ltd/);
  assert.match(sent[0].html, /https:\/\/trade-site-factory\.example\/owner/);
  assert.match(sent[0].html, /https:\/\/trade-site-factory\.example\/sites\/dee-valley-scaffolding/);
});

test('143 once welcome_email_sent_at is set, a normal page load does not resend it', async () => {
  const { client, rpcCalls } = createFakeClient('2026-08-29T12:00:00.000Z');
  let sendCalls = 0;
  const outcome = await ensureOwnerWelcomeEmailSent(client, PARAMS, { sendEmail: async () => void sendCalls++ });

  assert.equal(outcome, 'already-sent');
  assert.equal(sendCalls, 0, 'sendEmail must not be called once already marked delivered');
  assert.equal(rpcCalls.length, 0, 'the mark RPC must not be called again either');
});

test('144 a failed send does not mark delivery, and does not throw or touch anything else', async () => {
  const { client, rpcCalls } = createFakeClient(null);
  const outcome = await ensureOwnerWelcomeEmailSent(client, PARAMS, {
    sendEmail: async () => {
      throw new Error('simulated Resend outage');
    },
  });

  assert.equal(outcome, 'failed');
  assert.equal(rpcCalls.length, 0, 'a failed send must never be marked as delivered');
  // Ownership itself is never touched by this function at all — it only
  // ever reads business_members and, on success, calls the mark RPC. No
  // delete/update of business_members happens on this path, which is what
  // "ownership remains valid" actually rests on here.
});

test('145 a previously-failed send is retried on the next call, with no claim token involved anywhere in the signature', async () => {
  const { client, rpcCalls } = createFakeClient(null); // still null — the earlier attempt never marked it sent
  let attempt = 0;
  const send = async () => {
    attempt += 1;
    if (attempt === 1) throw new Error('simulated outage');
  };

  const first = await ensureOwnerWelcomeEmailSent(client, PARAMS, { sendEmail: send });
  assert.equal(first, 'failed');
  assert.equal(rpcCalls.length, 0);

  const second = await ensureOwnerWelcomeEmailSent(client, PARAMS, { sendEmail: send });
  assert.equal(second, 'sent');
  assert.equal(rpcCalls.length, 1);
  assert.equal(attempt, 2);
});
