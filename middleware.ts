/**
 * Supabase Auth middleware.
 *
 * Runs on every matched request to refresh the session cookie (so server
 * reads in Server Components see fresh auth) and to enforce coarse-grained
 * redirects between auth pages and protected routes.
 *
 * The cookie dance follows the `@supabase/ssr` v0.5 pattern: mirror cookies
 * onto BOTH the rebuilt request and the response so downstream handlers and
 * the browser stay in sync.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { env } from '@/lib/env';

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function middleware(request: NextRequest) {
  // Forward x-pathname through the REQUEST headers (not response headers)
  // so Server Components can read it via `headers()`. Setting it on the
  // response only sends it to the browser, which is not what we need.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // Re-pass the forwarded headers so x-pathname survives the cookie
          // dance — otherwise we'd lose it after the first setAll call.
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() must be called immediately after creating the client
  // and before any other code runs — it refreshes the session token.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Supabase redirects expired / invalid OTP links to the configured Site URL
  // (currently pointing at root while it's still localhost). Catch those error
  // params here and forward to /sign-in with a readable code.
  if (pathname === '/' && request.nextUrl.searchParams.has('error')) {
    const errorCode = request.nextUrl.searchParams.get('error_code') ?? 'verification_failed';
    const mapped = errorCode === 'otp_expired' ? 'link_expired' : 'verification_failed';
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    url.search = `?error=${mapped}`;
    return NextResponse.redirect(url);
  }

  const isAuthPage = pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up');
  const isProtectedPage = pathname.startsWith('/dashboard') || pathname.startsWith('/settings');

  if (!user && isProtectedPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    const redirectResponse = NextResponse.redirect(url);
    redirectResponse.headers.set('x-pathname', pathname);
    return redirectResponse;
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    const redirectResponse = NextResponse.redirect(url);
    redirectResponse.headers.set('x-pathname', pathname);
    return redirectResponse;
  }

  // (x-pathname is forwarded via the request headers we built at the top —
  // see NextResponse.next({ request: { headers: requestHeaders } }).
  // The authed layout reads it through `headers()` to drive active nav.)
  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     *  - _next/static (static assets)
     *  - _next/image (image optimization)
     *  - favicon, image files
     *  - /auth/* (Supabase email confirmation callback — must not be redirected)
     *  - /api/* (API routes manage their own auth)
     */
    '/((?!_next/static|_next/image|favicon.ico|auth/|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
