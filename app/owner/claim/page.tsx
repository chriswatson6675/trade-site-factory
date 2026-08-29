import { ClaimRedeem } from '../../../components/claim-redeem';
import { ConfigRequired } from '../../../components/config-required';
import { getDataMode } from '../../../lib/data/mode';

export const dynamic = 'force-dynamic';

export default async function OwnerClaimPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const mode = getDataMode();
  if (mode !== 'supabase') return <ConfigRequired />;

  const { token } = await searchParams;
  if (!token) {
    return (
      <main className="owner">
        <p className="demo">YOUR WEBSITE</p>
        <h1>This connection link is missing its token</h1>
        <p>Ask whoever set up your website to send you the full one-time link.</p>
      </main>
    );
  }

  return <ClaimRedeem token={token} />;
}
