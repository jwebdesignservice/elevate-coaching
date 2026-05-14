import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
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

  const metaAction = updateProgramMetaAction.bind(null, id);
  const addWeek = addWeekAction.bind(null, id);

  return (
    <>
      <TopBar title={`Edit: ${program.title}`} subtitle="Builder — weeks → sessions → exercises" userTier={profile.subscription_tier} userName={profile.name} />
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <Link href="/admin/programs" className="text-text-muted hover:text-text inline-flex items-center gap-1 text-sm">
          <ChevronLeft className="h-4 w-4" />Back to programmes
        </Link>

        {/* Metadata */}
        <Card className="bg-surface border-border p-6">
          <h2 className="text-text mb-4 font-semibold">Programme metadata</h2>
          <form action={metaAction} className="space-y-4">
            <input name="title" defaultValue={program.title} required className={`${INPUT} w-full`} placeholder="Title" />
            <textarea name="description" defaultValue={program.description ?? ''} rows={2} className={`${INPUT} w-full`} placeholder="Description" />
            <input name="cover_image_url" defaultValue={program.cover_image_url ?? ''} className={`${INPUT} w-full`} placeholder="Cover image URL" />
            <div className="grid grid-cols-3 gap-3">
              <select name="category" defaultValue={program.category ?? ''} className={INPUT}>
                <option value="">All categories</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
              <select name="plan_access" defaultValue={program.plan_access} className={INPUT}>
                <option value="free">Free</option>
                <option value="basic">Basic+</option>
                <option value="pro">Pro only</option>
              </select>
              <select name="status" defaultValue={program.status} className={INPUT}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
              </select>
            </div>
            <div className="flex justify-end">
              <Button type="submit" className="bg-accent text-accent-fg hover:bg-accent/90">Save metadata</Button>
            </div>
          </form>
        </Card>

        {/* Weeks */}
        {weeks.map((week) => {
          const sessions = [...(week.program_sessions ?? [])].sort((a, b) => a.session_number - b.session_number);
          const delWeek = deleteWeekAction.bind(null, id, week.id);
          const addSess = addSessionAction.bind(null, id, week.id);

          return (
            <Card key={week.id} className="bg-surface border-border p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-text font-semibold">Week {week.week_number}: {week.title}</h3>
                <form action={delWeek}>
                  <button type="submit" className="text-destructive hover:text-destructive/80 inline-flex items-center gap-1 text-xs">
                    <Trash2 className="h-3 w-3" />Delete week
                  </button>
                </form>
              </div>

              {sessions.map((session) => {
                const ses = [...(session.session_exercises ?? [])].sort((a, b) => a.order_index - b.order_index);
                const delSess = deleteSessionAction.bind(null, id, session.id);
                const addSE = addSessionExerciseAction.bind(null, id, session.id);

                return (
                  <div key={session.id} className="border-border rounded-md border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-text text-sm font-medium">Session {session.session_number}: {session.title}</p>
                      <form action={delSess}>
                        <button type="submit" className="text-destructive hover:text-destructive/80 text-xs">Delete</button>
                      </form>
                    </div>

                    {ses.map((se) => {
                      const removeSE = removeSessionExerciseAction.bind(null, id, se.id);
                      return (
                        <div key={se.id} className="bg-muted/50 flex items-center justify-between rounded-sm px-3 py-2 text-xs">
                          <span className="text-text">{se.exercises?.title ?? '—'}</span>
                          <span className="text-text-muted">
                            {se.sets ? `${se.sets}×` : ''}{se.reps ?? ''}{se.pct_of_1rm ? ` @ ${se.pct_of_1rm}%` : se.weight ? ` · ${se.weight}` : ''}
                          </span>
                          <form action={removeSE}>
                            <button type="submit" className="text-destructive hover:text-destructive/80">Remove</button>
                          </form>
                        </div>
                      );
                    })}

                    <form action={addSE} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <select name="exercise_id" required className={`${INPUT} col-span-2 sm:col-span-1`}>
                        <option value="">Pick exercise…</option>
                        {exercises.map((ex) => (
                          <option key={ex.id} value={ex.id}>{ex.title}</option>
                        ))}
                      </select>
                      <input name="sets" type="number" min="1" placeholder="Sets" className={INPUT} />
                      <input name="reps" placeholder="Reps (e.g. 5 or 8-12)" className={INPUT} />
                      <input name="weight" placeholder="Weight (e.g. 80kg)" className={INPUT} />
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
                      <Button type="submit" variant="outline" className="col-span-2 sm:col-span-1">
                        <Plus className="mr-1 h-3 w-3" />Add exercise
                      </Button>
                    </form>
                  </div>
                );
              })}

              <form action={addSess} className="border-border grid grid-cols-2 gap-2 border-t pt-3 sm:grid-cols-3">
                <input name="session_title" required placeholder="Session title" className={`${INPUT} col-span-2 sm:col-span-1`} />
                <input name="estimated_duration_mins" type="number" placeholder="Duration (mins)" className={INPUT} />
                <input name="completion_rule" placeholder="Completion rule (optional)" className={INPUT} />
                <Button type="submit" variant="outline" className="col-span-2 sm:col-span-1">
                  <Plus className="mr-1 h-3 w-3" />Add session
                </Button>
              </form>
            </Card>
          );
        })}

        {/* Add week */}
        <Card className="bg-surface border-border p-6">
          <h3 className="text-text mb-3 font-semibold">Add week</h3>
          <form action={addWeek} className="flex gap-3">
            <input name="week_title" required placeholder="Week title (e.g. Foundation)" className={`${INPUT} flex-1`} />
            <Button type="submit" className="bg-accent text-accent-fg hover:bg-accent/90">
              <Plus className="mr-1 h-4 w-4" />Add week
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
