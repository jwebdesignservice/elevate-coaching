import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Clock, Dumbbell, Timer, Repeat, Weight, Info, ExternalLink, Sparkles } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import { calcWeight, type MaxLifts } from '@/lib/lifts';
import { exerciseImage } from '@/lib/exercise-images';
import { SessionCompleteBtn } from './session-complete-btn';
import { completeSessionAction } from './actions';

type SessionExRow = {
  id: string;
  order_index: number;
  sets: number | null;
  reps: string | null;
  weight: string | null;
  pct_of_1rm: number | null;
  lift_key: string | null;
  rest_seconds: number | null;
  notes: string | null;
  exercises: { id: string; title: string; video_url: string | null; muscle_groups: string[] | null } | null;
};
type CompletionRow = { session_id: string };

export default async function SessionViewPage({ params }: { params: Promise<{ id: string; n: string; s: string }> }) {
  const { id, n, s } = await params;
  const weekNumber = parseInt(n);
  const sessionNumber = parseInt(s);
  const { profile } = await requireUser();
  const supabase = await createSupabaseServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const weekRes = await (sb.from('program_weeks').select('id, title').eq('program_id', id).eq('week_number', weekNumber).single() as Promise<{ data: { id: string; title: string } | null; error: unknown }>);
  if (!weekRes.data) notFound();
  const weekId = weekRes.data.id;
  const weekTitle = weekRes.data.title;

  const sessionRes = await (sb.from('program_sessions').select('id, session_number, title, instructions, estimated_duration_mins').eq('week_id', weekId).eq('session_number', sessionNumber).single() as Promise<{ data: { id: string; session_number: number; title: string; instructions: string | null; estimated_duration_mins: number | null } | null; error: unknown }>);
  if (!sessionRes.data) notFound();
  const session = sessionRes.data;

  const [seRes, completionRes] = await Promise.all([
    (sb.from('session_exercises').select('id, order_index, sets, reps, weight, pct_of_1rm, lift_key, rest_seconds, notes, exercises(id, title, video_url, muscle_groups)').eq('session_id', session.id).order('order_index') as Promise<{ data: SessionExRow[] | null; error: unknown }>),
    supabase.from('user_session_completions').select('session_id').eq('user_id', profile.id).eq('program_id', id),
  ]);

  const sessionExercises = seRes.data ?? [];
  const completedIds = new Set(((completionRes.data ?? []) as CompletionRow[]).map((c) => c.session_id));
  const alreadyDone = completedIds.has(session.id);
  const maxLifts = profile as unknown as MaxLifts;
  const completeAction = completeSessionAction.bind(null, id, weekNumber, session.id);

  // Aggregate muscle groups for this session
  const muscles = new Set<string>();
  for (const se of sessionExercises) {
    for (const mg of (se.exercises?.muscle_groups ?? [])) muscles.add(mg);
  }
  const muscleList = Array.from(muscles).slice(0, 6);
  const totalSets = sessionExercises.reduce((sum, x) => sum + (x.sets ?? 0), 0);

  return (
    <>
      <TopBar
        title={session.title}
        subtitle={`Week ${weekNumber} · Session ${sessionNumber}${session.estimated_duration_mins ? ` · ${session.estimated_duration_mins} min` : ''}`}
        userTier={profile.subscription_tier}
        userName={profile.name}
      />
      <div className="space-y-6 p-4 sm:p-6 lg:p-8 pb-28 lg:pb-8">
        <Link href={`/programs/${id}/week/${weekNumber}`} className="text-text-muted hover:text-text inline-flex items-center gap-1 text-sm">
          <ChevronLeft className="h-4 w-4" />Back to {weekTitle}
        </Link>

        {/* Hero */}
        <Card className="bg-surface border-border relative overflow-hidden p-0">
          <div className="from-accent/10 absolute inset-0 bg-gradient-to-br to-transparent" />
          <div className="relative p-6 sm:p-8">
            <p className="text-accent text-[10px] font-bold uppercase tracking-[0.18em]">
              <Sparkles className="mr-1 inline h-3 w-3" />
              Week {weekNumber} · Session {sessionNumber}
            </p>
            <h1 className="text-text mt-1.5 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
              {session.title}
            </h1>
            {session.instructions && (
              <p className="text-text-muted mt-2 max-w-2xl text-sm leading-relaxed">{session.instructions}</p>
            )}
            {alreadyDone && (
              <div className="bg-accent/15 text-accent border-accent/30 mt-4 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-wider">
                ✓ Completed
              </div>
            )}
          </div>
        </Card>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile icon={Dumbbell} value={sessionExercises.length} label="Exercises" />
          <StatTile icon={Repeat} value={totalSets || '—'} label="Total sets" />
          <StatTile icon={Clock} value={`${session.estimated_duration_mins ?? '—'}m`} label="Duration" />
          <StatTile icon={Timer} value={muscleList.length || '—'} label="Muscle groups" />
        </div>

        {/* Muscle group tags */}
        {muscleList.length > 0 && (
          <Card className="bg-surface border-border p-4 sm:p-5">
            <p className="text-text-dim mb-2 text-[10px] font-bold uppercase tracking-wider">Today&apos;s targets</p>
            <div className="flex flex-wrap gap-1.5">
              {muscleList.map((mg) => (
                <span key={mg} className="bg-muted text-text rounded-md px-2 py-1 text-xs font-medium capitalize">
                  {mg.replace(/-/g, ' ')}
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* Exercise list */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-text text-lg font-semibold">Today&apos;s workout</h2>
            <span className="text-text-dim text-xs">{sessionExercises.length} exercises</span>
          </div>
          <div className="space-y-4">
            {sessionExercises.map((se, i) => {
              const exTitle = se.exercises?.title ?? 'Unknown exercise';
              const img = exerciseImage(exTitle);
              const weightDisplay = se.pct_of_1rm != null ? calcWeight(se.pct_of_1rm, se.lift_key, maxLifts) : se.weight ?? null;
              const exMuscles = (se.exercises?.muscle_groups ?? []).slice(0, 3);
              return (
                <Card key={se.id} className="bg-surface border-border overflow-hidden p-0">
                  <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr]">
                    {/* Image with overlay number */}
                    <div className="relative h-40 sm:h-auto sm:min-h-[180px]">
                      {se.exercises?.id ? (
                        <Link href={`/exercises/${se.exercises.id}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img} alt={exTitle} className="h-full w-full object-cover transition-transform duration-300 hover:scale-105" />
                        </Link>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt={exTitle} className="h-full w-full object-cover" />
                      )}
                      <div className="absolute left-3 top-3">
                        <span className="bg-accent text-accent-fg flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold shadow-lg">
                          {i + 1}
                        </span>
                      </div>
                    </div>
                    {/* Body */}
                    <div className="flex flex-col gap-3 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {se.exercises?.id ? (
                            <Link href={`/exercises/${se.exercises.id}`} className="hover:text-accent">
                              <h3 className="text-text text-lg font-semibold leading-snug transition-colors">{exTitle}</h3>
                            </Link>
                          ) : (
                            <h3 className="text-text text-lg font-semibold leading-snug">{exTitle}</h3>
                          )}
                          {exMuscles.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {exMuscles.map((mg) => (
                                <span key={mg} className="text-text-dim text-[10px] capitalize">
                                  {mg.replace(/-/g, ' ')}
                                </span>
                              )).reduce<React.ReactNode[]>((acc, el, idx) => {
                                if (idx > 0) acc.push(<span key={`d-${idx}`} className="text-text-dim text-[10px]">·</span>);
                                acc.push(el);
                                return acc;
                              }, [])}
                            </div>
                          )}
                        </div>
                        {se.exercises?.video_url && (
                          <a
                            href={se.exercises.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-text-muted hover:text-accent flex items-center gap-1 text-xs"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Tutorial
                          </a>
                        )}
                      </div>

                      {/* Stat pills */}
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {se.sets != null && (
                          <StatPill label="Sets" value={String(se.sets)} icon={Repeat} />
                        )}
                        {se.reps && (
                          <StatPill label="Reps" value={se.reps} icon={Dumbbell} />
                        )}
                        {weightDisplay && (
                          <StatPill label="Load" value={weightDisplay} icon={Weight} accent />
                        )}
                        {se.rest_seconds != null && (
                          <StatPill label="Rest" value={`${se.rest_seconds}s`} icon={Timer} />
                        )}
                      </div>

                      {se.notes && (
                        <div className="bg-muted/40 text-text-muted flex items-start gap-2 rounded-md p-3 text-xs italic">
                          <Info className="text-text-dim mt-0.5 h-3 w-3 shrink-0" />
                          <span>{se.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Complete CTA — desktop inline */}
        <div className="hidden justify-end pt-2 lg:flex">
          <SessionCompleteBtn action={completeAction} alreadyDone={alreadyDone} />
        </div>
      </div>

      {/* Mobile sticky complete bar */}
      <div className="bg-surface/95 border-border fixed inset-x-0 bottom-0 z-20 border-t p-3 backdrop-blur-md lg:hidden">
        <SessionCompleteBtn action={completeAction} alreadyDone={alreadyDone} />
      </div>
    </>
  );
}

function StatTile({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: number | string; label: string }) {
  return (
    <div className="bg-surface border-border flex flex-col gap-1 rounded-md border p-3">
      <Icon className="text-accent h-4 w-4" />
      <span className="text-text text-2xl font-bold leading-none">{value}</span>
      <span className="text-text-dim text-[10px] font-medium uppercase tracking-wider">{label}</span>
    </div>
  );
}

function StatPill({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; accent?: boolean }) {
  return (
    <div className="border-border bg-muted/30 flex items-center gap-2 rounded-md border p-2">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${accent ? 'text-accent' : 'text-text-dim'}`} />
      <div className="min-w-0">
        <p className="text-text-dim text-[9px] font-medium uppercase leading-none tracking-wider">{label}</p>
        <p className={`mt-0.5 text-sm font-semibold leading-tight ${accent ? 'text-accent' : 'text-text'}`}>{value}</p>
      </div>
    </div>
  );
}
