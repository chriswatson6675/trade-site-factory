'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { redeemBusinessClaim } from '../lib/data/business-repository';
import { createClient } from '../lib/supabase/client';

/**
 * Redeems the one-time claim token from the URL (see
 * scripts/create-claim-link.ts) into ownership of a business, then sends
 * the owner into their normal /owner experience. This page is reached only
 * after passwordless authentication (it's under /owner/*, gated by
 * lib/supabase/proxy.ts) — matching the mission's "owner authenticates
 * passwordlessly → claim token is verified" order.
 */
export function ClaimRedeem({ token }: { token: string }) {
  const [state, setState] = useState<'working' | 'error'>('working');
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    redeemBusinessClaim(createClient(), token)
      .then(() => {
        // ?claimed=1 tells app/owner/page.tsx to show the first-time
        // success screen (mission section 5) instead of the normal
        // dashboard — see components/owner-claim-success.tsx.
        if (!cancelled) router.replace('/owner?claimed=1');
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'This link is invalid or has expired.');
        setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  if (state === 'working') {
    return (
      <main className="owner">
        <p className="demo">YOUR WEBSITE</p>
        <h1>Connecting your website…</h1>
      </main>
    );
  }

  return (
    <main className="owner">
      <p className="demo">YOUR WEBSITE</p>
      <h1>This connection link didn’t work</h1>
      <p>{error} Ask whoever set up your website to send you a fresh one-time link.</p>
    </main>
  );
}
