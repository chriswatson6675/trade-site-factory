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
