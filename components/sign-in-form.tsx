'use client';
import { FormEvent, useState } from 'react';
import { createClient } from '../lib/supabase/client';

export function SignInForm({ next }: { next: string }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`;
      const { error: signInError } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo } });
      if (signInError) throw signInError;
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send your sign-in link. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (sent)
    return (
      <main className="form-page success-page">
        <p className="eyebrow">Check your email</p>
        <h1>We’ve sent you a sign-in link</h1>
        <p>Open it on this device to get into your website controls. No password needed — and you’ll stay signed in.</p>
      </main>
    );

  return (
    <main className="form-page">
      <p className="eyebrow">Owner sign-in</p>
      <h1>Enter your email</h1>
      <p>We’ll send you a secure link — no password to remember.</p>
      <form onSubmit={submit}>
        <label>
          Email
          <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'SENDING…' : 'SEND SIGN-IN LINK'}
        </button>
      </form>
    </main>
  );
}
