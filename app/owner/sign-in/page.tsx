import { ConfigRequired } from '../../../components/config-required';
import { SignInForm } from '../../../components/sign-in-form';
import { getDataMode } from '../../../lib/data/mode';
import { safeRelativePath } from '../../../lib/safe-redirect';

export const dynamic = 'force-dynamic';

export default async function OwnerSignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const mode = getDataMode();
  if (mode !== 'supabase') return <ConfigRequired />;

  const params = await searchParams;
  return (
    <>
      {params.error && (
        <p className="error" role="alert">
          {params.error}
        </p>
      )}
      {/* next always comes from either our own proxy.ts (already a bare
          relative path+search) or a visitor-typed URL — safeRelativePath
          rejects anything carrying its own scheme/host, e.g. a phishing
          link like /owner/sign-in?next=https://evil.example. */}
      <SignInForm next={safeRelativePath(params.next)} />
    </>
  );
}
