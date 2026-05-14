import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ChevronLeft,
  CheckCircle2,
  Circle,
  Clock,
  Dumbbell,
  ArrowRight,
  Flame,
  PlayCircle,
} from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';

type SessionExSubRow = { exercises: { muscle_groups: string[] | null } | null };
type SessionRow = {
  id: string;
  session_number: number;
  title: string;
  estimated_duration_mins: number | null;
  session_exercises: SessionExSubRow[];
};
type WeekFull = {
  id: string;
  week_number: number;
  title: string;
  description: string | null;
  program_sessions: SessionRow[];
};
type CompletionRow = { session_id: string };

export default async function WeekDetailPage({ params }: { params: Promise<{ id: string; n: string }> }) {
  const { id, n } = await params;
  const weekNumber = parseInt(n);
  const { profile } = await requireUser();
  const supabase = await createSupabaseServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const [weekRes, completionsRes, programRes] = await Promise.all([
    sb.from('program_weeks')
      .select('id, week_number, title, description, program_sessions(id, session_number, title, estimated_duration_mins, session_exercises(exercises(muscle_groups)))')
      .eq('program_id', id).eq('week_number', weekNumber).single() as Promise<{ data: WeekFull | null; error: unknown }>,
    supabase.from('user_session_completions').select('session_id').eq('user_id', profile.id).eq('program_id', id),
    sb.from('programs').select('title').eq('id', id).single() as Promise<{ data: { title: string } | null; error: unknown }>,
  ]);

  if (!weekRes.data) notFound();

  const week = weekRes.data;
  const programTitle = programRes.data?.title ?? 'Programme';
  const completedIds = new Set(((completionsRes.data ?? []) as CompletionRow[]).map((c) => c.session_id));
  const sessions = [...(week.program_sessions ?? [])].sort((a, b) => a.session_number - b.session_number);
  const totalMins = sessions.reduce((s, x) => s + (x.estimated_duration_mins ?? 0), 0);
  const sessionsDone = sessions.filter((s) => completedIds.has(s.id)).length;
  const weekPct = sessions.length > 0 ? Math.round((sessionsDone / sessions.length) * 100) : 0;

  // Aggregate muscle groups across all sessions in this week
  const allMuscles = new Set<string>();
  for (const s of sessions) {
    for (const se of (s.session_exercises ?? [])) {
      for (const mg of (se.exercises?.muscle_groups ?? [])) allMuscles.add(mg);
    }
  }
  const muscleList = Array.from(allMuscles).slice(0, 8);

  return (
    <>
      <TopBar
        title={`Week ${week.week_number}: ${week.title}`}
        subtitle={`${sessionsDone}/${sessions.length} sessions · ${totalMins} min total`}
        userTier={profile.subscription_tier}
        userName={profile.name}
      />
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <Link href={`/programs/${id}`} className="text-text-muted hover:text-text inline-flex items-center gap-1 text-sm">
          <ChevronLeft className="h-4 w-4" />Back to {programTitle}
        </Link>

        {/* Hero */}
        <Card className="bg-surface border-border relative overflow-hidden p-0">
          <div className="from-accent/10 absolute inset-0 bg-gradient-to-br to-transparent" />
          <div className="relative p-6 sm:p-8">
            <div className="flex items-start gap-4 sm:gap-6">
              {/* Week number badge */}
              <div className="from-accent/20 to-accent/5 border-accent/30 flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl border bg-gradient-to-br sm:h-24 sm:w-24">
                <span className="text-text-dim text-[10px] font-bold uppercase tracking-wider">Week</span>
                <span className="text-accent text-3xl font-bold leading-none sm:text-4xl">{week.week_number}</span>
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <h1 className="text-text text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{week.title}</h1>
                {week.description && (
                  <p className="text-text-muted text-sm leading-relaxed">{week.description}</p>
                )}
                {/* Inline progress */}
                <div className="pt-2">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-text-dim">This week</span>
                    <span className={`font-bold ${weekPct === 100 ? 'text-accent' : 'text-text-muted'}`}>
                      {weekPct}%
                    </span>
                  </div>
                  <div className="bg-muted relative h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className="from-accent to-accent/60 absolute inset-y-0 left-0 rounded-full bg-gradient-to-r transition-all"
                      style={{ width: `${weekPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile icon={Dumbbell} value={sessions.length} label="Sessions" />
          <StatTile icon={Clock} value={`${totalMins}m`} label="Total time" />
          <StatTile icon={CheckCircle2} value={`${sessionsDone}/${sessions.length}`} label="Completed" />
          <StatTile icon={Flame} value={muscleList.length || '—'} label="Muscle groups" />
        </div>

        {/* Sessions */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-text text-lg font-semibold">Sessions</h2>
            <span className="text-text-dim text-xs">{sessions.length} total</span>
          </div>
          <div className="flex flex-col gap-4">
            {sessions.map((sess) => {
              const done = completedIds.has(sess.id);
              const exerciseCount = sess.session_exercises?.length ?? 0;
              const sessionMuscles = new Set<string>();
              for (const se of (sess.session_exercises ?? [])) {
                for (const mg of (se.exercises?.muscle_groups ?? [])) sessionMuscles.add(mg);
              }
              const previewMuscles = Array.from(sessionMuscles).slice(0, 3);
              return (
                <Link key={sess.id} href={`/programs/${id}/week/${weekNumber}/session/${sess.session_number}`}>
                  <Card className={`group bg-surface border-border hover:border-accent/40 relative overflow-hidden p-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 ${done ? '' : ''}`}>
                    <div className="flex items-stretch">
                      {/* Status block */}
                      <div className={`flex w-20 shrink-0 flex-col items-center justify-center gap-1 ${done ? 'bg-accent/15' : 'bg-muted/30'}`}>
                        {done ? (
                          <>
                            <CheckCircle2 className="text-accent h-6 w-6" />
                            <span className="text-accent text-[9px] font-bold uppercase tracking-wider">Done</span>
                          </>
                        ) : (
                          <>
                            <PlayCircle className="text-text-muted group-hover:text-accent h-6 w-6 transition-colors" />
                            <span className="text-text-dim text-[9px] font-bold uppercase tracking-wider">
                              Session {sess.session_number}
                            </span>
                          </>
                        )}
                      </div>
                      {/* Body */}
                      <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className={`font-semibold leading-snug transition-colors group-hover:text-accent/90 ${done ? 'text-text-muted line-through decoration-text-dim' : 'text-text'}`}>
                            {sess.title}
                          </h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs">
                          {sess.estimated_duration_mins != null && (
                            <span className="text-text-muted flex items-center gap-1">
                              <Clock className="text-text-dim h-3 w-3" />
                              {sess.estimated_duration_mins} min
                            </span>
                          )}
                          <span className="text-text-muted flex items-center gap-1">
                            <Dumbbell className="text-text-dim h-3 w-3" />
                            {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}
                          </span>
                        </div>
                        {previewMuscles.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {previewMuscles.map((mg) => (
                              <span key={mg} className="bg-muted text-text-dim rounded-sm px-1.5 py-0.5 text-[10px] capitalize">
                                {mg.replace(/-/g, ' ')}
                              </span>
                            ))}
                            {sessionMuscles.size > 3 && (
                              <span className="text-text-dim text-[10px]">+{sessionMuscles.size - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center pr-4 sm:pr-5">
                        <ArrowRight className="text-text-dim group-hover:text-accent h-4 w-4 transition-colors" />
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
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

// Suppress unused import warning — Circle is reserved for future "locked" session state
void Circle;
