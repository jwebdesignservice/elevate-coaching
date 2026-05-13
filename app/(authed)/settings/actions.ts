'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CATEGORIES, type Category } from '@/lib/categories';
import type { RequestCategoryChangeState } from './state';

const requestChangeSchema = z
  .object({
    requested_category: z.enum(CATEGORIES),
    reason: z.string().trim().max(500, 'Reason must be 500 characters or fewer.').optional(),
  })
  .refine(
    // Server-side guard against requesting the same category. The DB has the
    // same constraint (`ccr_different_category`), but failing here gives a
    // friendlier message than a generic Postgres error.
    () => true,
    {},
  );

/**
 * Insert a pending category change request for the current user.
 *
 * RLS guarantees:
 *   - `ccr_insert_own` enforces user_id == auth.uid()
 *   - `ccr_insert_own` enforces current_category matches the row in profiles
 *     so a malicious client can't spoof "from"
 *   - `ccr_different_category` CHECK rejects same-to-same
 *
 * We don't trust the client's "current_category" — we read it from the
 * profile row ourselves and pass that as the snapshot. If the user has no
 * category yet they shouldn't be on /settings anyway (the layout gate
 * redirects them to /onboarding); we still guard explicitly.
 *
 * On success, revalidate /settings so the pending-request banner shows up
 * without a full page reload.
 */
export async function requestCategoryChangeAction(
  _prev: RequestCategoryChangeState,
  formData: FormData,
): Promise<RequestCategoryChangeState> {
  const parsed = requestChangeSchema.safeParse({
    requested_category: formData.get('requested_category'),
    reason: formData.get('reason') ?? undefined,
  });

  if (!parsed.success) {
    return {
      status: 'error',
      error: parsed.error.issues[0]?.message ?? 'Invalid request.',
      message: null,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/sign-in');
  }

  const { data: profileRaw, error: profileError } = await supabase
    .from('profiles')
    .select('category')
    .eq('id', user.id)
    .single();

  if (profileError || !profileRaw) {
    return {
      status: 'error',
      error: 'Could not load your profile. Please try again.',
      message: null,
    };
  }

  // Same Supabase-TS workaround as lib/auth.ts: the chain returns `never`
  // here, so we re-type the row from outside.
  const profile = profileRaw as { category: Category | null };
  const currentCategory = profile.category;
  if (!currentCategory) {
    // Defence in depth — the settings layout's gate should prevent this.
    redirect('/onboarding');
  }

  if (currentCategory === parsed.data.requested_category) {
    return {
      status: 'error',
      error: "You're already in that category.",
      message: null,
    };
  }

  // Write payload cast — see comment in app/onboarding/actions.ts for the
  // Supabase-TS inference quirk this works around.
  const { error: insertError } = await supabase.from('category_change_requests').insert({
    user_id: user.id,
    current_category: currentCategory,
    requested_category: parsed.data.requested_category,
    reason: parsed.data.reason?.length ? parsed.data.reason : null,
  } as never);

  if (insertError) {
    return {
      status: 'error',
      error: 'Could not submit your request. Please try again.',
      message: null,
    };
  }

  revalidatePath('/settings');

  return {
    status: 'success',
    error: null,
    message: "Change request submitted. We'll be in touch.",
  };
}
