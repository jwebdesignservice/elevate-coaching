/**
 * Server-side auth helpers.
 *
 * These are intended for Server Components, route handlers, and Server
 * Actions. They wrap `createSupabaseServerClient()` and the `profiles` table
 * so callers get back a single `{ user, profile }` shape (or a redirect).
 *
 * Why call `auth.getUser()` instead of `auth.getSession()`?
 *   `getUser()` validates the JWT against Supabase Auth; `getSession()` only
 *   reads the cookie. Always prefer `getUser()` for authorization decisions.
 */

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';

export type Profile = Database['public']['Tables']['profiles']['Row'];

/**
 * Returns the current user + profile, or `null` if not signed in.
 *
 * Returns `null` (not throw) when there is no session OR when the profile
 * row hasn't been created yet (e.g., the `handle_new_user` trigger fires
 * but RLS hides the row for the current request — should be impossible in
 * practice). Callers that require a user should use `requireUser()`.
 */
export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !profile) return null;

  return { user, profile: profile as Profile };
}

/**
 * Returns the current user + profile, or redirects to `/sign-in`.
 *
 * Use in Server Components / Server Actions that should never render for
 * an unauthenticated user.
 */
export async function requireUser() {
  const current = await getCurrentUser();
  if (!current) redirect('/sign-in');
  return current;
}

/**
 * Returns the current user + profile, or redirects.
 *
 *  - Unauthenticated -> `/sign-in`
 *  - Authenticated but role !== 'coach' -> `/dashboard`
 *
 * Use to gate the coach-only admin surface.
 */
export async function requireCoach() {
  const current = await requireUser();
  if (current.profile.role !== 'coach') redirect('/dashboard');
  return current;
}
