import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ChevronLeft,
  Plus,
  Trash2,
  Calendar,
  Dumbbell,
  Clock,
  Pencil,
  Sparkles,
  Layers,
} from 'lucide-react';
import { requireCoach } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  updateProgramMetaAction,
  addWeekAction,
  deleteWeekAction,
  addSessionAction,
  deleteSessionAction,
  addSessionExerciseAction,
  removeSessionExerciseAction,
} from './actions';

type SessionExerciseFull = {
  id: string; order_index: number; sets: number | null; reps: string | null;
  weight: string | null; pct_of_1rm: number | null; lift_key: string | null;
  rest_seconds: number | null; notes: string | null;
  exercises: { id: string; title: string } | null;
};
type SessionFull = {
  id: string; session_number: number; title: string; instructions: string | null;
  estimated_duration_mins: number | null; completion_rule: string | null;
  session_exercises: SessionExerciseFull[];
};
type WeekFull = {
  id: string; week_number: number; title: string; description: string | null;
  program_sessions: SessionFull[];
};
type ProgramFull = {
  id: string; title: string; description: string | null; cover_image_url: string | null;
  category: string | null; plan_access: string; status: string;
  program_weeks: WeekFull[];
};
type ExerciseOption = { id: string; title: string };

const INPUT = 'bg-background border-border text-text placeholder:text-text-dim focus-visible:border-accent/40 rounded-md border px-3 py-2 text-sm outline-none transition-colors';

export const metadata = { title: 'Edit Programme · Admin · Elevate Coaching' };

export default async function EditProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireCoach();
  const supabase = await createSupabaseServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [programRes, exercisesRes] = await Promise.all([
    (supabase as any)
      .from('programs')
      .select(`id, title, description, cover_image_url, category, plan_access, status,
        program_weeks ( id, week_number, title, description,
          program_sessions ( id, session_number, title, instructions, estimated_duration_mins, completion_rule,
            session_exercises ( id, order_index, sets, reps, weight, pct_of_1rm, lift_key, rest_seconds, notes,
              exercises ( id, title ) ) ) )`)
      .eq('id', id)
      .single() as Promise<{ data: ProgramFull | null; error: unknown }>,
    supabase.from('exercises').select('id, title').order('title'),
  ]);

  if (!programRes.data) notFound();

  const program = programRes.data as ProgramFull;
  const exercises = (exercisesRes.data ?? []) as ExerciseOption[];
  const weeks = [...(program.program_weeks ?? [])].sort((a, b) => a.week_number - b.week_number);

  // Stats
  const allSessions = weeks.flatMap((w) => w.program_sessions ?? []);
  const totalSessions = allSessions.length;
  const totalExercises = allSessions.reduce((sum, s) => sum + (s.session_exercises?.length ?? 0), 0);
  const totalMins = allSessions.reduce((s, x) => s + (x.estimated_duration_mins ?? 0), 0);
  const isActive = program.status === 'active';

  const metaAction = updateProgramMetaAction.bind(null, id);
  const addWeek = addWeekAction.bind(null, id);

  return (
    <>
      <TopBar
        title={`Edit: ${program.title}`}
        subtitle={`${weeks.length} weeks · ${totalSessions} sessions · ${totalExercises} exercises`}
        userTier={profile.subscription_tier}
        userName={profile.name}
      />
      <div className="space-y-8 p-4 sm:p-6 lg:p-8">
        <Link href="/admin/programs" className="text-text-muted hover:text-text inline-flex items-center gap-1 text-sm">
          <ChevronLeft className="h-4 w-4" />Back to programmes
        </Link>

        {/* Hero with cover preview */}
        <Card className="bg-surface border-border relative overflow-hidden p-0">
          <div className="relative h-52 sm:h-64">
            {program.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={program.cover_image_url} alt={program.title} className="absolute inset-0 block h-full w-full object-cover" />
            ) : (
              <div className="bg-muted absolute inset-0" />
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface via-surface/60 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <p className="text-accent text-[10px] font-bold uppercase tracking-[0.18em]">
                <Pencil className="mr-1.5 inline h-3 w-3" />
                Editing
              </p>
              <h1 className="text-text mt-1 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{program.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {program.category && (
                  <span className="bg-black/60 text-white backdrop-blur-sm rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                    Cat {program.category}
                  </span>
                )}
                <span className="bg-black/60 text-white backdrop-blur-sm rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider capitalize">
                  {program.plan_access === 'free' ? 'Free' : `${program.plan_access}+`}
                </span>
                <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  isActive ? 'bg-accent text-accent-fg' : 'bg-black/60 text-white backdrop-blur-sm'
                }`}>
                  {isActive ? 'Live' : 'Draft'}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile icon={Calendar} value={weeks.length} label="Weeks" />
          <StatTile icon={Dumbbell} value={totalSessions} label="Sessions" />
          <StatTile icon={Layers} value={totalExercises} label="Exercises" />
          <StatTile icon={Clock} value={`${Math.round(totalMins / 60) || '—'}h`} label="Total time" />
        </div>

        {/* Metadata form */}
        <Card className="bg-surface border-border p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="text-accent h-4 w-4" />
            <h2 className="text-text font-semibold">Programme metadata</h2>
          </div>
          <form action={metaAction} className="space-y-4">
            <div>
              <label className="text-text mb-1.5 block text-sm font-medium">Title</label>
              <input name="title" defaultValue={program.title} required className={`${INPUT} w-full`} placeholder="Title" />
            </div>
            <div>
              <label className="text-text mb-1.5 block text-sm font-medium">Description</label>
              <textarea name="description" defaultValue={program.description ?? ''} rows={2} className={`${INPUT} w-full`} placeholder="Description" />
            </div>
            <div>
              <label className="text-text mb-1.5 block text-sm font-medium">Cover image URL</label>
              <input name="cover_image_url" defaultValue={program.cover_image_url ?? ''} className={`${INPUT} w-full`} placeholder="https://…" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="text-text-dim mb-1 block text-[10px] font-bold uppercase tracking-wider">Category</label>
                <select name="category" defaultValue={program.category ?? ''} className={`${INPUT} w-full`}>
                  <option value="">All categories</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              </div>
              <div>
                <label className="text-text-dim mb-1 block text-[10px] font-bold uppercase tracking-wider">Plan access</label>
                <select name="plan_access" defaultValue={program.plan_access} className={`${INPUT} w-full`}>
                  <option value="free">Free</option>
                  <option value="basic">Basic+</option>
                  <option value="pro">Pro only</option>
                </select>
              </div>
              <div>
                <label className="text-text-dim mb-1 block text-[10px] font-bold uppercase tracking-wider">Status</label>
                <select name="status" defaultValue={program.status} className={`${INPUT} w-full`}>
                  <option value="draft">Draft</option>
                  <option value="active">Active (live)</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" className="bg-accent text-accent-fg hover:bg-accent/80 hover:text-white hover:border-accent">
                Save metadata
              </Button>
            </div>
          </form>
        </Card>

        {/* Weeks builder */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-text text-lg font-semibold">Programme weeks</h2>
            <span className="text-text-dim text-xs">{weeks.length} {weeks.length === 1 ? 'week' : 'weeks'}</span>
          </div>

          {weeks.length === 0 && (
            <Card className="bg-surface border-border p-8 text-center">
              <Calendar className="text-text-dim mx-auto h-7 w-7" />
              <p className="text-text-muted mt-3 text-sm">No weeks yet. Add the first week below.</p>
            </Card>
          )}

          <div className="flex flex-col gap-4">
            {weeks.map((week) => {
              const sessions = [...(week.program_sessions ?? [])].sort((a, b) => a.session_number - b.session_number);
              const delWeek = deleteWeekAction.bind(null, id, week.id);
              const addSess = addSessionAction.bind(null, id, week.id);
              const weekMins = sessions.reduce((s, x) => s + (x.estimated_duration_mins ?? 0), 0);

              return (
                <Card key={week.id} className="bg-surface border-border overflow-hidden p-0">
                  {/* Week header */}
                  <div className="flex items-stretch">
                    <div className="from-accent/15 to-accent/5 border-accent/20 flex w-20 shrink-0 flex-col items-center justify-center gap-0.5 border-r bg-gradient-to-br">
                      <span className="text-text-dim text-[10px] font-bold uppercase tracking-wider">Week</span>
                      <span className="text-accent text-2xl font-bold leading-none">{week.week_number}</span>
                    </div>
                    <div className="flex flex-1 items-center justify-between gap-3 px-5 py-4">
                      <div className="min-w-0">
                        <h3 className="text-text font-semibold leading-tight">{week.title}</h3>
                        <div className="text-text-dim mt-1 flex items-center gap-3 text-[11px]">
                          <span className="flex items-center gap-1">
                            <Dumbbell className="h-3 w-3" />
                            {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
                          </span>
                          {weekMins > 0 && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {weekMins} min
                            </span>
                          )}
                        </div>
                      </div>
                      <form action={delWeek}>
                        <button type="submit" className="text-text-dim hover:text-destructive inline-flex items-center gap-1 text-[11px] transition-colors">
                          <Trash2 className="h-3 w-3" />
                          Delete week
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Sessions */}
                  <div className="space-y-3 p-5">
                    {sessions.length === 0 && (
                      <p className="text-text-dim py-3 text-center text-xs italic">No sessions yet.</p>
                    )}
                    {sessions.map((session) => {
                      const ses = [...(session.session_exercises ?? [])].sort((a, b) => a.order_index - b.order_index);
                      const delSess = deleteSessionAction.bind(null, id, session.id);
                      const addSE = addSessionExerciseAction.bind(null, id, session.id);

                      return (
                        <Card key={session.id} className="bg-muted/20 border-border overflow-hidden p-0">
                          {/* Session header */}
                          <div className="border-border flex items-center justify-between border-b px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="bg-accent/15 text-accent flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
                                {session.session_number}
                              </span>
                              <div>
                                <p className="text-text text-sm font-semibold leading-tight">{session.title}</p>
                                <div className="text-text-dim mt-0.5 flex items-center gap-3 text-[11px]">
                                  <span>{ses.length} {ses.length === 1 ? 'exercise' : 'exercises'}</span>
                                  {session.estimated_duration_mins != null && (
                                    <span>{session.estimated_duration_mins} min</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <form action={delSess}>
                              <button type="submit" className="text-text-dim hover:text-destructive text-[11px] transition-colors">
                                Delete
                              </button>
                            </form>
                          </div>

                          {/* Existing session exercises */}
                          {ses.length > 0 && (
                            <div className="border-border divide-border divide-y border-b">
                              {ses.map((se, i) => {
                                const removeSE = removeSessionExerciseAction.bind(null, id, se.id);
                                const detail = [
                                  se.sets ? `${se.sets}×` : null,
                                  se.reps ?? null,
                                  se.pct_of_1rm ? `@ ${se.pct_of_1rm}%` : se.weight ?? null,
                                  se.rest_seconds ? `${se.rest_seconds}s rest` : null,
                                ].filter(Boolean).join(' ');
                                return (
                                  <div key={se.id} className="bg-background/40 flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
                                    <div className="flex min-w-0 items-center gap-3">
                                      <span className="text-text-dim w-4 text-right text-[10px] font-medium">
                                        {i + 1}.
                                      </span>
                                      <span className="text-text font-medium">{se.exercises?.title ?? '—'}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-text-muted">{detail || '—'}</span>
                                      <form action={removeSE}>
                                        <button type="submit" className="text-text-dim hover:text-destructive transition-colors" aria-label="Remove">
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </form>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Add exercise form */}
                          <form action={addSE} className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
                            <select name="exercise_id" required className={`${INPUT} col-span-2 sm:col-span-1`}>
                              <option value="">Pick exercise…</option>
                              {exercises.map((ex) => (
                                <option key={ex.id} value={ex.id}>{ex.title}</option>
                              ))}
                            </select>
                            <input name="sets" type="number" min="1" placeholder="Sets" className={INPUT} />
                            <input name="reps" placeholder="Reps (5 or 8-12)" className={INPUT} />
                            <input name="weight" placeholder="Weight" className={INPUT} />
                            <input name="pct_of_1rm" type="number" min="1" max="100" placeholder="% 1RM" className={INPUT} />
                            <select name="lift_key" className={INPUT}>
                              <option value="">No 1RM key</option>
                              <option value="squat">Squat</option>
                              <option value="bench">Bench</option>
                              <option value="deadlift">Deadlift</option>
                              <option value="ohp">OHP</option>
                            </select>
                            <input name="rest_seconds" type="number" placeholder="Rest (s)" className={INPUT} />
                            <input name="notes" placeholder="Notes" className={INPUT} />
                            <Button type="submit" variant="outline" className="col-span-2 sm:col-span-4">
                              <Plus className="mr-1 h-3 w-3" />Add exercise to this session
                            </Button>
                          </form>
                        </Card>
                      );
                    })}

                    {/* Add session form */}
                    <form action={addSess} className="border-border bg-muted/30 grid grid-cols-2 gap-2 rounded-md border border-dashed p-3 sm:grid-cols-3">
                      <input name="session_title" required placeholder="Session title" className={`${INPUT} col-span-2 sm:col-span-1`} />
                      <input name="estimated_duration_mins" type="number" placeholder="Duration (mins)" className={INPUT} />
                      <input name="completion_rule" placeholder="Completion rule (optional)" className={INPUT} />
                      <Button type="submit" variant="outline" className="col-span-2 sm:col-span-3">
                        <Plus className="mr-1 h-3 w-3" />Add session
                      </Button>
                    </form>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Add week (always at the bottom) */}
          <Card className="bg-surface border-border border-dashed p-5">
            <h3 className="text-text mb-3 text-sm font-semibold">Add a new week</h3>
            <form action={addWeek} className="flex flex-col gap-2 sm:flex-row sm:gap-3">
              <input name="week_title" required placeholder="Week title (e.g. Foundation)" className={`${INPUT} flex-1`} />
              <Button type="submit" className="bg-accent text-accent-fg hover:bg-accent/80 hover:text-white hover:border-accent">
                <Plus className="mr-1 h-4 w-4" />Add week
              </Button>
            </form>
          </Card>
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
