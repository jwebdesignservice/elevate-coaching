/**
 * Supabase client for Client Components.
 *
 * Uses the publishable (anon) key. RLS policies apply — any query will be
 * scoped to the currently signed-in user (or anon if not signed in).
 *
 * Usage in a Client Component:
 *   'use client';
 *   import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
 *   const supabase = createSupabaseBrowserClient();
 *   const { data } = await supabase.from('profiles').select('*').single();
 *
 * For Server Components, route handlers, and Server Actions, use
 * `createSupabaseServerClient` from `./server` instead.
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';
import { env } from '@/lib/env';

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
