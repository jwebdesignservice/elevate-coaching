import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * POST /api/tasks/[id]/toggle
 *
 * Body: { date: 'YYYY-MM-DD' } — the user's local date for the toggle.
 *
 * Reads the user's existing completion row for (task_id, date) and flips it:
 * inserts if absent, deletes if present. Returns { done: boolean }.
 *
 * The route accepts any past `date` value — RLS scopes inserts/deletes to
 * the authed user's own rows. Server actions / streak math are computed off
 * the user's local-today, so backfilling old days has no UI effect.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: taskId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const date = (body as { date?: unknown })?.date;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'invalid date' }, { status: 400 });
  }

  const { profile } = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from('user_task_completions')
    .select('id')
    .eq('user_id', profile.id)
    .eq('task_id', taskId)
    .eq('completion_date', date)
    .maybeSingle();

  if (existing) {
    // DELETE — if the row was already gone (concurrent untick from another tab),
    // PostgREST returns success with zero rows affected. Either way the end state
    // is "not done".
    const { error } = await supabase
      .from('user_task_completions')
      .delete()
      .eq('id', (existing as { id: string }).id);
    if (error) return NextResponse.json({ error: 'failed to delete' }, { status: 500 });
    return NextResponse.json({ done: false });
  }

  // INSERT — a concurrent insert from another tab will violate the unique
  // (user_id, task_id, completion_date) constraint and return 23505. The desired
  // state ("done") is achieved either way, so treat 23505 as idempotent success.
  const { error } = await supabase
    .from('user_task_completions')
    .insert({ user_id: profile.id, task_id: taskId, completion_date: date } as never);
  if (error) {
    // PostgrestError carries the SQLSTATE in `.code`. 23505 = unique_violation.
    const code = (error as { code?: string }).code;
    if (code === '23505') return NextResponse.json({ done: true });
    return NextResponse.json({ error: 'failed to insert' }, { status: 500 });
  }
  return NextResponse.json({ done: true });
}
