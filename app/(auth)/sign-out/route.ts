/**
 * Sign-out endpoint.
 *
 * Expects a POST from a `<form>` so the request is same-origin and the
 * browser includes the session cookie. Returns a redirect to `/sign-in`
 * so the form post results in a normal navigation.
 */

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/sign-in', request.url), { status: 303 });
}
