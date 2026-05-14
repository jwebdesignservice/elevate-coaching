'use server';

import { revalidatePath } from 'next/cache';
import { requireCoach } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

function builderPath(programId: string) {
  return `/admin/programs/${programId}/edit`;
}

export async function updateProgramMetaAction(programId: string, formData: FormData) {
  await requireCoach();
  const title = (formData.get('title') as string)?.trim();
  if (!title) return;

  const adminClient = createSupabaseAdminClient();
  await adminClient.from('programs').update({
    title,
    description: (formData.get('description') as string) || null,
    cover_image_url: (formData.get('cover_image_url') as string) || null,
    category: (formData.get('category') as string) || null,
    plan_access: formData.get('plan_access') as string,
    status: formData.get('status') as string,
  } as never).eq('id', programId);

  revalidatePath(builderPath(programId));
}

export async function addWeekAction(programId: string, formData: FormData) {
  await requireCoach();
  const title = (formData.get('week_title') as string)?.trim();
  if (!title) return;

  const adminClient = createSupabaseAdminClient();
  const { data: existing } = await adminClient
    .from('program_weeks')
    .select('week_number')
    .eq('program_id', programId)
    .order('week_number', { ascending: false })
    .limit(1);

  const rows = (existing ?? []) as { week_number: number }[];
  const nextWeek = (rows[0]?.week_number ?? 0) + 1;

  await adminClient.from('program_weeks').insert({
    program_id: programId,
    week_number: nextWeek,
    title,
    description: (formData.get('week_description') as string) || null,
  } as never);

  revalidatePath(builderPath(programId));
}

export async function deleteWeekAction(programId: string, weekId: string) {
  await requireCoach();
  const adminClient = createSupabaseAdminClient();
  await adminClient.from('program_weeks').delete().eq('id', weekId);
  revalidatePath(builderPath(programId));
}

export async function addSessionAction(programId: string, weekId: string, formData: FormData) {
  await requireCoach();
  const title = (formData.get('session_title') as string)?.trim();
  if (!title) return;

  const adminClient = createSupabaseAdminClient();
  const { data: existing } = await adminClient
    .from('program_sessions')
    .select('session_number')
    .eq('week_id', weekId)
    .order('session_number', { ascending: false })
    .limit(1);

  const rows = (existing ?? []) as { session_number: number }[];
  const nextSession = (rows[0]?.session_number ?? 0) + 1;

  await adminClient.from('program_sessions').insert({
    week_id: weekId,
    session_number: nextSession,
    title,
    instructions: (formData.get('session_instructions') as string) || null,
    estimated_duration_mins: parseInt(formData.get('estimated_duration_mins') as string) || null,
    completion_rule: (formData.get('completion_rule') as string) || null,
  } as never);

  revalidatePath(builderPath(programId));
}

export async function deleteSessionAction(programId: string, sessionId: string) {
  await requireCoach();
  const adminClient = createSupabaseAdminClient();
  await adminClient.from('program_sessions').delete().eq('id', sessionId);
  revalidatePath(builderPath(programId));
}

export async function addSessionExerciseAction(programId: string, sessionId: string, formData: FormData) {
  await requireCoach();
  const exerciseId = (formData.get('exercise_id') as string)?.trim();
  if (!exerciseId) return;

  const adminClient = createSupabaseAdminClient();
  const { data: existing } = await adminClient
    .from('session_exercises')
    .select('order_index')
    .eq('session_id', sessionId)
    .order('order_index', { ascending: false })
    .limit(1);

  const rows = (existing ?? []) as { order_index: number }[];
  const nextIndex = (rows[0]?.order_index ?? -1) + 1;

  const pctRaw = parseInt(formData.get('pct_of_1rm') as string);
  const pctOf1rm = isNaN(pctRaw) ? null : pctRaw;

  await adminClient.from('session_exercises').insert({
    session_id: sessionId,
    exercise_id: exerciseId,
    order_index: nextIndex,
    sets: parseInt(formData.get('sets') as string) || null,
    reps: (formData.get('reps') as string) || null,
    weight: (formData.get('weight') as string) || null,
    pct_of_1rm: pctOf1rm,
    lift_key: (formData.get('lift_key') as string) || null,
    rest_seconds: parseInt(formData.get('rest_seconds') as string) || null,
    notes: (formData.get('notes') as string) || null,
  } as never);

  revalidatePath(builderPath(programId));
}

export async function removeSessionExerciseAction(programId: string, seId: string) {
  await requireCoach();
  const adminClient = createSupabaseAdminClient();
  await adminClient.from('session_exercises').delete().eq('id', seId);
  revalidatePath(builderPath(programId));
}
