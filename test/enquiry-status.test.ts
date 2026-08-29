import test from 'node:test';
import assert from 'node:assert/strict';
import { assertValidTransition } from '../lib/data/enquiry-status.ts';

test('46 a legal enquiry status transition does not throw', () => {
  assert.doesNotThrow(() => assertValidTransition('new', 'contacted'));
});

test('47 an illegal enquiry status transition throws and is never silently applied', () => {
  assert.throws(() => assertValidTransition('won', 'quoted'), /Cannot move/);
});

test('48 a terminal status accepts no further transition except itself', () => {
  assert.doesNotThrow(() => assertValidTransition('lost', 'lost'));
  assert.throws(() => assertValidTransition('lost', 'new'));
});

// Named exactly per mission section 5's acceptance scenarios — kept
// separate from the general cases above for direct traceability. The
// authority for these rules in production is transition_enquiry_status()
// (supabase/migrations/20260829120300_rls_policies.sql); this asserts the
// application-level rule set, and test/migration-grants.test.ts asserts
// the SQL truth table matches it exactly.
test('89 new -> contacted is allowed', () => assert.doesNotThrow(() => assertValidTransition('new', 'contacted')));
test('90 new -> quoted is rejected', () => assert.throws(() => assertValidTransition('new', 'quoted')));
test('91 contacted -> quoted is allowed', () => assert.doesNotThrow(() => assertValidTransition('contacted', 'quoted')));
test('92 quoted -> won is allowed', () => assert.doesNotThrow(() => assertValidTransition('quoted', 'won')));
test('93 won -> quoted is rejected', () => assert.throws(() => assertValidTransition('won', 'quoted')));
