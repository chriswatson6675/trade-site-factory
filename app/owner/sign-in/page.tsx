import { ConfigRequired } from '../../../components/config-required';
import { SignInForm } from '../../../components/sign-in-form';
import { getDataMode } from '../../../lib/data/mode';
import { safeRedirectPath } from '../../../lib/safe-redirect';

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
      <SignInForm next={safeRedirectPath(params.next)} />
    </>
  );
}
