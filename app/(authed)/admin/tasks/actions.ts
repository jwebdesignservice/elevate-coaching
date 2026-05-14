'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCoach } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

const CATEGORY = z.enum(['A', 'B', 'C', 'D']);
const TASK_TYPE = z.enum(['workout', 'nutrition', 'mindset', 'recovery', 'steps', 'other']);
const DAY = z.coerce.number().int().min(1).max(7);
const ISO_DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const createWeekSchema = z.object({
  category: CATEGORY,
  start_date: ISO_DATE,
});

/**
 * Create (or no-op) a task_weeks row for (category, start_date).
 * Idempotent via the unique (category, start_date) constraint.
 */
export async function createDraftWeekAction(formData: FormData): Promise<void> {
  await requireCoach();
  const parsed = createWeekSchema.safeParse({
    category: formData.get('category'),
    start_date: formData.get('start_date'),
  });
  if (!parsed.success) return;

  const admin = createSupabaseAdminClient();
  await admin
    .from('task_weeks')
    .upsert(
      { category: parsed.data.category, start_date: parsed.data.start_date } as never,
      { onConflict: 'category,start_date' } as never,
    );

  revalidatePath('/admin/tasks');
  redirect(`/admin/tasks?cat=${parsed.data.category}`);
}

const upsertTaskSchema = z.object({
  task_id: z.string().uuid().optional(),
  week_id: z.string().uuid(),
  day_of_week: DAY,
  task_type: TASK_TYPE,
  title: z.string().trim().min(1),
});

/**
 * Create or update a daily_tasks row. Updates preserve the row's stable ID
 * so user_task_completions referencing it survive intact.
 */
export async function upsertTaskAction(formData: FormData): Promise<void> {
  await requireCoach();
  const parsed = upsertTaskSchema.safeParse({
    task_id: formData.get('task_id') || undefined,
    week_id: formData.get('week_id'),
    day_of_week: formData.get('day_of_week'),
    task_type: formData.get('task_type'),
    title: formData.get('title'),
  });
  if (!parsed.success) return;

  const admin = createSupabaseAdminClient();

  if (parsed.data.task_id) {
    await admin
      .from('daily_tasks')
      .update({
        task_type: parsed.data.task_type,
        title: parsed.data.title,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', parsed.data.task_id);
  } else {
    const { count } = await admin
      .from('daily_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('week_id', parsed.data.week_id)
      .eq('day_of_week', parsed.data.day_of_week);

    await admin.from('daily_tasks').insert({
      week_id: parsed.data.week_id,
      day_of_week: parsed.data.day_of_week,
      task_type: parsed.data.task_type,
      title: parsed.data.title,
      order_index: count ?? 0,
    } as never);
  }

  revalidatePath('/admin/tasks');
}

export async function deleteTaskAction(formData: FormData): Promise<void> {
  await requireCoach();
  const id = formData.get('task_id');
  if (typeof id !== 'string') return;
  const admin = createSupabaseAdminClient();
  await admin.from('daily_tasks').delete().eq('id', id);
  revalidatePath('/admin/tasks');
}

/**
 * Swap a task's order_index with its prev (direction=up) or next (direction=down)
 * neighbour in the same (week, day) bucket. Two sequential updates — SP-5
 * accepts the small race window; admin-only and low contention.
 */
export async function reorderTaskAction(formData: FormData): Promise<void> {
  await requireCoach();
  const id = formData.get('task_id');
  const direction = formData.get('direction');
  if (typeof id !== 'string' || (direction !== 'up' && direction !== 'down')) return;

  const admin = createSupabaseAdminClient();
  const { data: targetRaw } = await admin
    .from('daily_tasks')
    .select('id, week_id, day_of_week, order_index')
    .eq('id', id)
    .single();
  if (!targetRaw) return;
  const target = targetRaw as {
    id: string;
    week_id: string;
    day_of_week: number;
    order_index: number;
  };

  const base = admin
    .from('daily_tasks')
    .select('id, order_index')
    .eq('week_id', target.week_id)
    .eq('day_of_week', target.day_of_week);

  const { data: neighbourRaw } = await (direction === 'up'
    ? base
        .lt('order_index', target.order_index)
        .order('order_index', { ascending: false })
        .limit(1)
        .maybeSingle()
    : base
        .gt('order_index', target.order_index)
        .order('order_index', { ascending: true })
        .limit(1)
        .maybeSingle());

  const neighbour = neighbourRaw as { id: string; order_index: number } | null;
  if (!neighbour) return; // already at edge

  await admin
    .from('daily_tasks')
    .update({ order_index: neighbour.order_index } as never)
    .eq('id', target.id);
  await admin
    .from('daily_tasks')
    .update({ order_index: target.order_index } as never)
    .eq('id', neighbour.id);

  revalidatePath('/admin/tasks');
}
