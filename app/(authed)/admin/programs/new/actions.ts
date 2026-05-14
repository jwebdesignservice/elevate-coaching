'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCoach } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import type { ProgramFormState } from './program-form';

const schema = z.object({
  title: z.string().trim().min(1, 'Title is required.'),
  description: z.string().trim().optional(),
  cover_image_url: z.string().trim().url().optional().or(z.literal('')),
  category: z.enum(['A', 'B', 'C', 'D', '']),
  plan_access: z.enum(['free', 'basic', 'pro']),
  status: z.enum(['draft', 'active']),
});

export async function createProgramAction(_prev: ProgramFormState, formData: FormData): Promise<ProgramFormState> {
  await requireCoach();

  const parsed = schema.safeParse({
    title: formData.get('title'),
    description: formData.get('description') ?? undefined,
    cover_image_url: formData.get('cover_image_url') ?? '',
    category: formData.get('category') ?? '',
    plan_access: formData.get('plan_access') ?? 'free',
    status: formData.get('status') ?? 'draft',
  });

  if (!parsed.success) return { status: 'error', error: parsed.error.issues[0]?.message ?? 'Invalid input.' };

  const { title, description, cover_image_url, category, plan_access, status } = parsed.data;

  const adminClient = createSupabaseAdminClient();
  const { data: newProgram, error } = await adminClient
    .from('programs')
    .insert({ title, description: description || null, cover_image_url: cover_image_url || null, category: category || null, plan_access, status } as never)
    .select('id')
    .single();

  if (error || !newProgram) return { status: 'error', error: 'Failed to create programme. Please try again.' };

  const prog = newProgram as { id: string };
  revalidatePath('/admin/programs');
  redirect(`/admin/programs/${prog.id}/edit`);
}
