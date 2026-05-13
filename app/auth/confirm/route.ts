/**
 * Supabase email confirmation callback.
 *
 * After a new user clicks the confirmation link in their welcome email,
 * Supabase redirects them here with `token_hash` and `type` query params.
 * We exchange those for a session and forward them to `next` (default
 * `/dashboard`).
 *
 * Note: this route is excluded from the auth middleware matcher so the
 * redirect through `/sign-in` doesn't interfere with the OTP exchange.
 */

import { type EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/dashboard';

  if (token_hash && type) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL('/sign-in?error=verification_failed', request.url));
}
