// First-time post-claim success state (mission section 5). Rendered by
// app/owner/page.tsx only immediately after a successful claim redirect
// (?claimed=1 — see components/claim-redeem.tsx), never on a normal /owner
// visit, and never shows the one-time claim link itself.
import Link from 'next/link';

export function OwnerClaimSuccess({
  businessName,
  manageUrl,
  viewUrl,
  emailSent,
}: {
  businessName: string;
  manageUrl: string;
  viewUrl: string;
  emailSent: boolean;
}) {
  return (
    <main className="owner success-page claim-success">
      <p className="demo">YOUR WEBSITE IS READY</p>
      <h1>You’re connected</h1>
      <p>
        <b>{businessName}</b> is now connected to your account.
      </p>
      <div className="owner-actions claim-success-actions">
        <a className="btn" href={manageUrl}>
          MANAGE MY WEBSITE
        </a>
        <a className="btn outline" href={viewUrl} target="_blank" rel="noreferrer">
          VIEW MY WEBSITE
        </a>
      </div>
      <p className="hint">
        {emailSent
          ? 'We’ve emailed these links to you so you can come back anytime.'
          : 'We’ll keep trying to email you these links — you can always get back here by signing in again at /owner.'}
      </p>
      <Link className="back" href="/owner">
        Continue to your website controls
      </Link>
    </main>
  );
}
