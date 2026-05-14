'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCoach } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import type { ExerciseFormState } from '../../new/exercise-form';

const schema = z.object({
  title: z.string().trim().min(1, 'Title is required.'),
  description: z.string().trim().optional(),
  video_url: z.string().trim().url('Must be a valid URL.').optional().or(z.literal('')),
  muscle_groups: z.array(z.string()).default([]),
  tags: z.string().trim().optional(),
});

export async function updateExerciseAction(id: string, _prev: ExerciseFormState, formData: FormData): Promise<ExerciseFormState> {
  await requireCoach();

  const parsed = schema.safeParse({
    title: formData.get('title'),
    description: formData.get('description') ?? undefined,
    video_url: formData.get('video_url') ?? '',
    muscle_groups: formData.getAll('muscle_groups') as string[],
    tags: formData.get('tags') ?? undefined,
  });

  if (!parsed.success) return { status: 'error', error: parsed.error.issues[0]?.message ?? 'Invalid input.' };

  const { title, description, video_url, muscle_groups, tags } = parsed.data;
  const tagArray = tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [];

  const adminClient = createSupabaseAdminClient();
  const { error } = await adminClient.from('exercises')
    .update({ title, description: description || null, video_url: video_url || null, muscle_groups, tags: tagArray } as never)
    .eq('id', id);

  if (error) return { status: 'error', error: 'Failed to update exercise. Please try again.' };

  revalidatePath('/admin/exercises');
  redirect('/admin/exercises');
}
