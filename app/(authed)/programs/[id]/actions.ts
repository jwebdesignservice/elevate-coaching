'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function enrollAction(programId: string) {
  const { profile } = await requireUser();
  const supabase = await createSupabaseServerClient();

  await supabase.from('user_program_enrollments').upsert(
    { user_id: profile.id, program_id: programId } as never,
    { onConflict: 'user_id,program_id' },
  );

  await supabase.from('progress_logs').insert({
    user_id: profile.id,
    metric_type: 'program_enrolled',
    related_program_id: programId,
  } as never);

  revalidatePath(`/programs/${programId}`);
  revalidatePath('/dashboard');
}
