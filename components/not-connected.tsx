/**
 * Shown to a signed-in user with no business_members row and no valid
 * claim in the URL. Deliberately does not invite them to type/guess a
 * business slug — the only way to connect an account to a business is a
 * one-time claim link (see scripts/create-claim-link.ts and
 * app/owner/claim/page.tsx).
 */
export function NotConnected() {
  return (
    <main className="owner">
      <p className="demo">YOUR WEBSITE</p>
      <h1>Your website hasn’t been connected to this account yet</h1>
      <p>Ask whoever set up your Trade Site Factory website to resend your one-time connection link, then open it while signed in on this device.</p>
    </main>
  );
}
