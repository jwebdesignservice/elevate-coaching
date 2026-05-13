'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CATEGORIES } from '@/lib/categories';
import type { OnboardingState } from './state';

const onboardingSchema = z.object({
  category: z.enum(CATEGORIES),
});

/**
 * Set the user's training category for the first time.
 *
 * Why the `.is('category', null)` filter:
 *   profiles_update_own RLS only checks ownership, not value transitions. To
 *   prevent a returning user from quietly re-onboarding (e.g., by re-visiting
 *   /onboarding manually and submitting), we add an explicit precondition:
 *   the UPDATE only matches when category is still NULL. A user with a
 *   category already set will see zero rows affected; the integration test
 *   asserts this no-op behaviour.
 *
 * On success this function `redirect()`s to /dashboard — which throws the
 * NEXT_REDIRECT sentinel and never returns. The OnboardingState shape only
 * carries the error path.
 */
export async function setCategoryAction(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const parsed = onboardingSchema.safeParse({
    category: formData.get('category'),
  });

  if (!parsed.success) {
    return {
      status: 'error',
      error: 'Please pick a category before continuing.',
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/sign-in');
  }

  const { error } = await supabase
    .from('profiles')
    .update({ category: parsed.data.category })
    .eq('id', user.id)
    .is('category', null);

  if (error) {
    return {
      status: 'error',
      error: 'Something went wrong saving your category. Please try again.',
    };
  }

  redirect('/dashboard');
}
