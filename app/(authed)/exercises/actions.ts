'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type ExerciseRecordState = {
  status: 'idle' | 'error' | 'success';
  error: string | null;
  message: string | null;
};

export const exerciseRecordInitialState: ExerciseRecordState = { status: 'idle', error: null, message: null };

/**
 * Map our four "main lifts" to the column on profiles that feeds
 * `calcWeight()` (used by the session view to compute working weights
 * from percentages-of-1RM). When the user updates the 1RM for one of
 * these exercises, we mirror it into profiles so existing programming
 * stays correct.
 */
const MAIN_LIFT_PROFILE_COL: Record<string, 'max_lift_squat' | 'max_lift_bench' | 'max_lift_deadlift' | 'max_lift_ohp'> = {
  'Back Squat': 'max_lift_squat',
  'Bench Press': 'max_lift_bench',
  'Conventional Deadlift': 'max_lift_deadlift',
  'Overhead Press': 'max_lift_ohp',
};

function parseKg(formData: FormData, name: string): number | null {
  const raw = formData.get(name);
  if (raw == null || raw === '') return null;
  const num = parseFloat(String(raw));
  if (!isFinite(num) || num < 0 || num > 1000) return null;
  return num;
}

export async function updateExerciseRecordAction(
  exerciseId: string,
  _prev: ExerciseRecordState,
  formData: FormData,
): Promise<ExerciseRecordState> {
  const { profile } = await requireUser();
  const supabase = await createSupabaseServerClient();

  const one = parseKg(formData, 'one_rm_kg');
  const five = parseKg(formData, 'five_rm_kg');
  const twelve = parseKg(formData, 'twelve_rm_kg');

  // Lookup exercise title (for main-lift sync logic)
  const { data: exRaw } = await supabase.from('exercises').select('title').eq('id', exerciseId).single();
  if (!exRaw) return { status: 'error', error: 'Exercise not found', message: null };
  const title = (exRaw as { title: string }).title;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error: upsertErr } = await sb
    .from('user_exercise_records')
    .upsert({
      user_id: profile.id,
      exercise_id: exerciseId,
      one_rm_kg: one,
      five_rm_kg: five,
      twelve_rm_kg: twelve,
      updated_at: new Date().toISOString(),
    } as never, { onConflict: 'user_id,exercise_id' });

  if (upsertErr) {
    return { status: 'error', error: 'Could not save record. Please try again.', message: null };
  }

  // Mirror 1RM to profile for the four main lifts (keeps calcWeight working)
  const mainCol = MAIN_LIFT_PROFILE_COL[title];
  if (mainCol && one != null) {
    await sb.from('profiles').update({ [mainCol]: one } as never).eq('id', profile.id);
  }

  revalidatePath(`/exercises/${exerciseId}`);
  revalidatePath('/settings');
  return { status: 'success', error: null, message: 'Saved' };
}
