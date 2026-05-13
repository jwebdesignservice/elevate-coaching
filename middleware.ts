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
  let supabaseResponse = NextResponse.next({ request });

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
          supabaseResponse = NextResponse.next({ request });
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

  // Expose the request pathname to Server Components (e.g., the authed
  // layout uses it to compute active Sidebar nav state).
  supabaseResponse.headers.set('x-pathname', pathname);
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
