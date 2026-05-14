import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import { calcWeight, type MaxLifts } from '@/lib/lifts';
import { SessionCompleteBtn } from './session-complete-btn';
import { completeSessionAction } from './actions';

type SessionExRow = { id: string; order_index: number; sets: number | null; reps: string | null; weight: string | null; pct_of_1rm: number | null; lift_key: string | null; rest_seconds: number | null; notes: string | null; exercises: { title: string } | null };
type CompletionRow = { session_id: string };

export default async function SessionViewPage({ params }: { params: Promise<{ id: string; n: string; s: string }> }) {
  const { id, n, s } = await params;
  const weekNumber = parseInt(n);
  const sessionNumber = parseInt(s);
  const { profile } = await requireUser();
  const supabase = await createSupabaseServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const weekRes = await (sb.from('program_weeks').select('id').eq('program_id', id).eq('week_number', weekNumber).single() as Promise<{ data: { id: string } | null; error: unknown }>);
  if (!weekRes.data) notFound();
  const weekId = weekRes.data.id;

  const sessionRes = await (sb.from('program_sessions').select('id, session_number, title, instructions, estimated_duration_mins').eq('week_id', weekId).eq('session_number', sessionNumber).single() as Promise<{ data: { id: string; session_number: number; title: string; instructions: string | null; estimated_duration_mins: number | null } | null; error: unknown }>);
  if (!sessionRes.data) notFound();

  const session = sessionRes.data;

  const [seRes, completionRes] = await Promise.all([
    (sb.from('session_exercises').select('id, order_index, sets, reps, weight, pct_of_1rm, lift_key, rest_seconds, notes, exercises(title)').eq('session_id', session.id).order('order_index') as Promise<{ data: SessionExRow[] | null; error: unknown }>),
    supabase.from('user_session_completions').select('session_id').eq('user_id', profile.id).eq('program_id', id),
  ]);

  const sessionExercises = seRes.data ?? [];
  const completedIds = new Set(((completionRes.data ?? []) as CompletionRow[]).map((c) => c.session_id));
  const alreadyDone = completedIds.has(session.id);
  const maxLifts = profile as unknown as MaxLifts;
  const completeAction = completeSessionAction.bind(null, id, weekNumber, session.id);

  return (
    <>
      <TopBar title={session.title} subtitle={`Week ${weekNumber} · Session ${sessionNumber}${session.estimated_duration_mins ? ` · ${session.estimated_duration_mins} min` : ''}`} userTier={profile.subscription_tier} userName={profile.name} />
      <div className="max-w-2xl space-y-6 p-4 sm:p-6 lg:p-8">
        <Link href={`/programs/${id}/week/${weekNumber}`} className="text-text-muted hover:text-text inline-flex items-center gap-1 text-sm"><ChevronLeft className="h-4 w-4" />Back to week</Link>
        {session.instructions && (
          <Card className="bg-surface border-border p-5">
            <p className="text-text-muted text-sm leading-relaxed">{session.instructions}</p>
          </Card>
        )}
        <div className="space-y-3">
          {sessionExercises.map((se, i) => {
            const weightDisplay = se.pct_of_1rm != null ? calcWeight(se.pct_of_1rm, se.lift_key, maxLifts) : se.weight ?? null;
            return (
              <Card key={se.id} className="bg-surface border-border p-5">
                <div className="flex items-start gap-3">
                  <span className="bg-accent/15 text-accent flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold">{i + 1}</span>
                  <div className="flex-1 space-y-2">
                    <h3 className="text-text font-semibold">{se.exercises?.title ?? 'Unknown exercise'}</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                      {se.sets != null && <div><span className="text-text-dim text-[10px] uppercase tracking-wider">Sets</span><p className="text-text font-medium">{se.sets}</p></div>}
                      {se.reps && <div><span className="text-text-dim text-[10px] uppercase tracking-wider">Reps</span><p className="text-text font-medium">{se.reps}</p></div>}
                      {weightDisplay && <div><span className="text-text-dim text-[10px] uppercase tracking-wider">Load</span><p className="text-accent font-medium">{weightDisplay}</p></div>}
                      {se.rest_seconds != null && <div><span className="text-text-dim text-[10px] uppercase tracking-wider">Rest</span><p className="text-text font-medium">{se.rest_seconds}s</p></div>}
                    </div>
                    {se.notes && <p className="text-text-dim text-xs italic">{se.notes}</p>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
        <div className="flex justify-end pt-2">
          <SessionCompleteBtn action={completeAction} alreadyDone={alreadyDone} />
        </div>
      </div>
    </>
  );
}
