// Magic-link / OTP confirmation endpoint. Supabase's email link points
// here with a token_hash; we exchange it for a session (setting cookies
// via lib/supabase/server.ts) and send the owner back into the app —
// see app/owner/sign-in/page.tsx for where the link is requested.
import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { safeRedirectPath } from '../../../lib/safe-redirect';
import { createClient } from '../../../lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = safeRedirectPath(searchParams.get('next'));

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const errorUrl = new URL('/owner/sign-in', origin);
  errorUrl.searchParams.set('error', 'Your sign-in link is invalid or has expired. Please request a new one.');
  return NextResponse.redirect(errorUrl);
}
