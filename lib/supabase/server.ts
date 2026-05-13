/**
 * Supabase clients for server-side code (Server Components, route handlers,
 * Server Actions, middleware).
 *
 * Two flavors:
 *
 *   - createSupabaseServerClient()  — uses the publishable (anon) key with
 *     cookie-based session. Subject to RLS. Use this for normal authenticated
 *     reads / writes that should be scoped to the current user.
 *
 *   - createSupabaseAdminClient()   — uses the service_role key. BYPASSES RLS.
 *     Use ONLY when the action genuinely requires admin privileges (e.g.,
 *     coach-promotion flow, subscription tier update after Stripe webhook).
 *     Never expose its return value to the browser. Never call from a route
 *     handler that proxies user-controlled SQL.
 *
 * Both must be called inside a request scope (so `cookies()` resolves).
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from './database.types';
import { env } from '@/lib/env';

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // setAll() is called from a Server Component context where cookies
          // can't be mutated. Safe to ignore — middleware refreshes sessions.
        }
      },
    },
  });
}

/**
 * Admin client — bypasses RLS. Use sparingly.
 *
 * Returns a non-cookied client backed by the service_role key. Suitable for:
 *  - Background jobs (cron, queue workers)
 *  - Stripe webhook handlers that need to update other users' tier
 *  - Admin coach actions explicitly gated by `requireCoach()`
 *
 * Do NOT use for ordinary authenticated queries — those should go through
 * createSupabaseServerClient() so RLS applies.
 */
export function createSupabaseAdminClient() {
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
