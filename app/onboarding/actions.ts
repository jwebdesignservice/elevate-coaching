'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CATEGORIES } from '@/lib/categories';
import type { OnboardingState } from './state';

const liftField = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
  z.number().int().min(1).max(999).optional(),
);

const onboardingSchema = z.object({
  category: z.enum(CATEGORIES),
  experience_level: z.enum(['beginner', 'intermediate', 'advanced']),
  max_lift_squat: liftField,
  max_lift_bench: liftField,
  max_lift_deadlift: liftField,
  max_lift_ohp: liftField,
});

/**
 * Complete onboarding: saves category, experience level, and optional max
 * lifts in a single update.
 *
 * The `.is('category', null)` precondition prevents a returning user from
 * re-onboarding by manually revisiting /onboarding — zero rows are updated
 * if category is already set.
 */
export async function completeOnboardingAction(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const parsed = onboardingSchema.safeParse({
    category: formData.get('category'),
    experience_level: formData.get('experience_level'),
    max_lift_squat: formData.get('max_lift_squat'),
    max_lift_bench: formData.get('max_lift_bench'),
    max_lift_deadlift: formData.get('max_lift_deadlift'),
    max_lift_ohp: formData.get('max_lift_ohp'),
  });

  if (!parsed.success) {
    return {
      status: 'error',
      error: 'Please complete all required fields before continuing.',
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { error } = await supabase
    .from('profiles')
    .update({
      category: parsed.data.category,
      experience_level: parsed.data.experience_level,
      max_lift_squat: parsed.data.max_lift_squat ?? null,
      max_lift_bench: parsed.data.max_lift_bench ?? null,
      max_lift_deadlift: parsed.data.max_lift_deadlift ?? null,
      max_lift_ohp: parsed.data.max_lift_ohp ?? null,
    } as never)
    .eq('id', user.id)
    .is('category', null);

  if (error) {
    return {
      status: 'error',
      error: 'Something went wrong saving your profile. Please try again.',
    };
  }

  redirect('/dashboard');
}
