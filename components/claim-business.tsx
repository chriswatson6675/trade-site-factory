'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { claimBusiness } from '../lib/data/business-repository';
import { createClient } from '../lib/supabase/client';

/**
 * Shown to a signed-in owner with no business_members row yet. Claiming is
 * an explicit, one-time action gated by claim_unclaimed_business() (see
 * supabase/migrations/20260829120300_rls_policies.sql) — it only succeeds
 * while the target business has zero owners, so this can never silently
 * hand someone else's business away.
 */
export function ClaimBusiness() {
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await claimBusiness(createClient(), slug.trim());
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not connect this business.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="owner">
      <p className="demo">YOUR WEBSITE</p>
      <h1>Connect your business</h1>
      <p>Enter the website slug from your Trade Site Factory setup (for example, “dee-valley-scaffolding”) to take charge of its enquiries and jobs.</p>
      <form onSubmit={submit}>
        <label>
          Business slug
          <input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="dee-valley-scaffolding" />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="btn" type="submit" disabled={busy || !slug.trim()}>
          {busy ? 'CONNECTING…' : 'CONNECT'}
        </button>
      </form>
    </main>
  );
}
