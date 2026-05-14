import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, CheckCircle, Circle, Lock } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { hasPlanAtLeast, type PlanTier } from '@/lib/plans';
import { programProgressPct } from '@/lib/programs';
import { enrollAction } from './actions';

type ProgramRow = { id: string; title: string; description: string | null; cover_image_url: string | null; plan_access: string };
type WeekRow = { id: string; week_number: number; title: string; program_sessions: { id: string }[] };
type EnrolmentRow = { current_week_number: number; last_session_id: string | null } | null;
type CompletionRow = { session_id: string };

export default async function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireUser();
  const supabase = await createSupabaseServerClient();
  const tier = (profile.subscription_tier as PlanTier) ?? 'free';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const [programRes, weeksRes, enrolmentRes, completionsRes] = await Promise.all([
    sb.from('programs').select('id, title, description, cover_image_url, plan_access').eq('id', id).single() as Promise<{ data: ProgramRow | null; error: unknown }>,
    sb.from('program_weeks').select('id, week_number, title, program_sessions(id)').eq('program_id', id).order('week_number') as Promise<{ data: WeekRow[] | null; error: unknown }>,
    supabase.from('user_program_enrollments').select('current_week_number, last_session_id').eq('user_id', profile.id).eq('program_id', id).maybeSingle(),
    supabase.from('user_session_completions').select('session_id').eq('user_id', profile.id).eq('program_id', id),
  ]);

  if (!programRes.data) notFound();

  const program = programRes.data as ProgramRow;
  const weeks = (weeksRes.data ?? []) as WeekRow[];
  const enrolment = (enrolmentRes.data ?? null) as EnrolmentRow;
  const completedIds = new Set(((completionsRes.data ?? []) as CompletionRow[]).map((c) => c.session_id));

  const canAccess = hasPlanAtLeast(tier, program.plan_access as PlanTier);
  const isEnrolled = enrolment !== null;
  const totalSessions = weeks.reduce((sum, w) => sum + (w.program_sessions?.length ?? 0), 0);
  const progressPct = programProgressPct(totalSessions, completedIds.size);

  const enrol = enrollAction.bind(null, id);

  let continueHref = `/programs/${id}/week/1`;
  outer: for (const week of weeks) {
    for (const sess of (week.program_sessions ?? [])) {
      if (!completedIds.has(sess.id)) { continueHref = `/programs/${id}/week/${week.week_number}`; break outer; }
    }
  }

  return (
    <>
      <TopBar title={program.title} subtitle={`${totalSessions} sessions · ${progressPct}% complete`} userTier={profile.subscription_tier} userName={profile.name} />
      <div className="max-w-2xl space-y-6 p-4 sm:p-6 lg:p-8">
        <Link href="/programs" className="text-text-muted hover:text-text inline-flex items-center gap-1 text-sm"><ChevronLeft className="h-4 w-4" />All programmes</Link>
        <Card className="bg-surface border-border overflow-hidden p-0">
          {program.cover_image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={program.cover_image_url} alt={program.title} className="h-48 w-full object-cover" />
          )}
          <div className="space-y-4 p-6">
            <h1 className="text-text text-2xl font-bold">{program.title}</h1>
            {program.description && <p className="text-text-muted leading-relaxed">{program.description}</p>}
            {!canAccess && (
              <div className="border-border bg-muted/50 flex items-center gap-3 rounded-md border p-4">
                <Lock className="text-text-dim h-5 w-5 shrink-0" />
                <div>
                  <p className="text-text text-sm font-medium">Requires {program.plan_access} plan</p>
                  <Link href="/pricing" className="text-accent text-xs hover:underline">Upgrade to unlock →</Link>
                </div>
              </div>
            )}
            {canAccess && (
              <div className="flex items-center gap-3">
                {isEnrolled ? (
                  <Link href={continueHref} className={buttonVariants({ className: 'bg-accent text-accent-fg hover:bg-accent/25 hover:text-white hover:border-accent/60' })}>Continue programme →</Link>
                ) : (
                  <form action={enrol}><Button type="submit" className="bg-accent text-accent-fg hover:bg-accent/25 hover:text-white hover:border-accent/60">Start programme</Button></form>
                )}
              </div>
            )}
            {isEnrolled && (
              <div>
                <div className="mb-1 flex items-center justify-between text-xs"><span className="text-text-dim">Progress</span><span className="text-text-muted">{progressPct}%</span></div>
                <div className="bg-muted h-1.5 w-full rounded-full"><div className="bg-accent h-1.5 rounded-full transition-all" style={{ width: `${progressPct}%` }} /></div>
              </div>
            )}
          </div>
        </Card>
        {canAccess && (
          <div className="space-y-3">
            <h2 className="text-text font-semibold">Programme weeks</h2>
            {weeks.map((week) => {
              const weekSessions = week.program_sessions ?? [];
              const weekDone = weekSessions.filter((s) => completedIds.has(s.id)).length;
              return (
                <Link key={week.id} href={`/programs/${id}/week/${week.week_number}`}>
                  <Card className="bg-surface border-border hover:border-accent/40 flex items-center justify-between p-4 transition-all hover:-translate-y-0.5">
                    <div className="flex items-center gap-3">
                      {weekDone === weekSessions.length && weekSessions.length > 0 ? <CheckCircle className="text-accent h-5 w-5 shrink-0" /> : <Circle className="text-text-dim h-5 w-5 shrink-0" />}
                      <div>
                        <p className="text-text font-medium">Week {week.week_number}: {week.title}</p>
                        <p className="text-text-muted text-xs">{weekDone}/{weekSessions.length} sessions done</p>
                      </div>
                    </div>
                    <ChevronLeft className="text-text-dim h-4 w-4 rotate-180" />
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
