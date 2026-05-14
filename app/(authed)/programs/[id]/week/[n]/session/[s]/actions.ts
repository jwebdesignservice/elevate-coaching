'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function completeSessionAction(programId: string, weekNumber: number, sessionId: string) {
  const { profile } = await requireUser();
  const supabase = await createSupabaseServerClient();

  await supabase.from('user_session_completions').upsert(
    { user_id: profile.id, session_id: sessionId, program_id: programId, week_number: weekNumber } as never,
    { onConflict: 'user_id,session_id' },
  );

  await supabase.from('progress_logs').insert({
    user_id: profile.id,
    metric_type: 'session_completed',
    related_program_id: programId,
    related_session_id: sessionId,
  } as never);

  await supabase.from('user_program_enrollments').update({ last_session_id: sessionId } as never).eq('user_id', profile.id).eq('program_id', programId);

  revalidatePath(`/programs/${programId}`);
  revalidatePath('/dashboard');
}
