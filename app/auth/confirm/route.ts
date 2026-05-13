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

/**
 * Whitelist-style validation for the `next` query param to defeat
 * open-redirect attacks. We require:
 *   - starts with a single `/` (relative path)
 *   - does NOT start with `//` or `/\` (protocol-relative / Windows escape)
 *   - does NOT contain `\` or whitespace
 *
 * Anything that fails falls back to `/dashboard`. We don't try to
 * preserve query strings or fragments here — confirmation deep-links
 * always land on a known canonical destination.
 */
function safeNext(raw: string | null): string {
  if (!raw) return '/dashboard';
  if (raw.length < 2 || raw[0] !== '/') return '/dashboard';
  if (raw[1] === '/' || raw[1] === '\\') return '/dashboard';
  if (/[\s\\]/.test(raw)) return '/dashboard';
  return raw;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = safeNext(searchParams.get('next'));

  if (token_hash && type) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL('/sign-in?error=verification_failed', request.url));
}
