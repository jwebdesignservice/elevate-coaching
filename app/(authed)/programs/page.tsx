import Link from 'next/link';
import { Lock, LayoutList, Calendar, Dumbbell, Clock, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { hasPlanAtLeast, type PlanTier } from '@/lib/plans';
import { programProgressPct } from '@/lib/programs';

export const metadata = { title: 'Programmes · Elevate Coaching' };

type ProgramRow = {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  category: string | null;
  plan_access: string;
  status: string;
  program_weeks: { id: string; program_sessions: { id: string; estimated_duration_mins: number | null }[] }[];
};
type EnrolmentRow = { program_id: string; current_week_number: number };
type CompletionRow = { session_id: string; program_id: string };

export default async function ProgramsPage() {
  const { profile } = await requireUser();
  const supabase = await createSupabaseServerClient();
  const tier = (profile.subscription_tier as PlanTier) ?? 'free';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const [programsRes, enrolmentsRes, completionsRes] = await Promise.all([
    sb.from('programs')
      .select('id, title, description, cover_image_url, category, plan_access, status, program_weeks(id, program_sessions(id, estimated_duration_mins))')
      .eq('status', 'active')
      .order('created_at') as Promise<{ data: ProgramRow[] | null; error: unknown }>,
    supabase.from('user_program_enrollments').select('program_id, current_week_number').eq('user_id', profile.id),
    supabase.from('user_session_completions').select('session_id, program_id').eq('user_id', profile.id),
  ]);

  const programs = (programsRes.data ?? []) as ProgramRow[];
  const enrolments = new Map(((enrolmentsRes.data ?? []) as EnrolmentRow[]).map((e) => [e.program_id, e]));
  const completions = ((completionsRes.data ?? []) as CompletionRow[]);

  const isCoach = profile.role === 'coach';
  const accessible = isCoach
    ? programs
    : programs.filter((p) => !profile.category || !p.category || p.category === profile.category);

  // Build stats for each programme
  const decorated = accessible.map((p) => {
    const weeks = p.program_weeks ?? [];
    const sessions = weeks.flatMap((w) => w.program_sessions ?? []);
    const totalMins = sessions.reduce((sum, s) => sum + (s.estimated_duration_mins ?? 0), 0);
    const completedCount = completions.filter((c) => c.program_id === p.id).length;
    const progressPct = programProgressPct(sessions.length, completedCount);
    return {
      ...p,
      weeksCount: weeks.length,
      sessionsCount: sessions.length,
      totalMins,
      progressPct,
      enrolment: enrolments.get(p.id) ?? null,
    };
  });

  // Find an in-progress programme to feature
  const active = decorated.find((p) => p.enrolment && p.progressPct < 100);
  const firstName = profile.name?.split(' ')[0] ?? 'there';

  return (
    <>
      <TopBar
        title="Programmes"
        subtitle="Your training journeys"
        userTier={profile.subscription_tier}
        userName={profile.name}
      />
      <div className="space-y-8 p-4 sm:p-6 lg:p-8">
        {/* Personal hero */}
        <section className="space-y-2">
          <p className="text-text-dim text-xs font-medium uppercase tracking-[0.18em]">
            <Sparkles className="mr-1.5 inline h-3 w-3" />
            Welcome back, {firstName}
          </p>
          <h1 className="text-text text-3xl font-bold tracking-tight sm:text-4xl">Choose your journey.</h1>
          <p className="text-text-muted max-w-xl text-sm">
            Structured, coach-built programmes. Pick one that matches where you are — every week builds on the last.
          </p>
        </section>

        {/* Continue training (only if user has an in-progress programme) */}
        {active && (
          <section>
            <p className="text-text-dim mb-2 text-xs font-semibold uppercase tracking-wider">Continue Training</p>
            <Link href={`/programs/${active.id}`}>
              <Card className="bg-surface border-border hover:border-accent/40 group relative overflow-hidden p-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-accent/10">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr]">
                  {active.cover_image_url && (
                    <div className="relative h-48 md:h-auto">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={active.cover_image_url} alt={active.title} className="absolute inset-0 h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-surface/95" />
                    </div>
                  )}
                  <div className="flex flex-col justify-center gap-4 p-6 sm:p-8">
                    <div>
                      <p className="text-accent text-xs font-semibold uppercase tracking-wider">In progress</p>
                      <h2 className="text-text mt-1 text-2xl font-bold leading-tight">{active.title}</h2>
                    </div>
                    {/* Inline progress bar */}
                    <div>
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="text-text-muted">
                          Week {active.enrolment?.current_week_number ?? 1} of {active.weeksCount}
                        </span>
                        <span className="text-accent font-semibold">{active.progressPct}%</span>
                      </div>
                      <div className="bg-muted relative h-2 w-full overflow-hidden rounded-full">
                        <div
                          className="from-accent to-accent/60 absolute inset-y-0 left-0 rounded-full bg-gradient-to-r transition-all"
                          style={{ width: `${active.progressPct}%` }}
                        />
                      </div>
                    </div>
                    <span className={buttonVariants({ className: 'bg-accent text-accent-fg hover:bg-accent/80 hover:text-white hover:border-accent w-fit' })}>
                      Resume training
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </span>
                  </div>
                </div>
              </Card>
            </Link>
          </section>
        )}

        {/* All programmes grid */}
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <h2 className="text-text text-lg font-semibold">All programmes</h2>
            <span className="text-text-dim text-xs">{accessible.length} available</span>
          </div>
          {accessible.length === 0 && (
            <Card className="bg-surface border-border p-12 text-center">
              <LayoutList className="text-text-dim mx-auto h-8 w-8" />
              <p className="text-text-muted mt-3">No programmes available yet.</p>
            </Card>
          )}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {decorated.map((p) => {
              const canAccess = hasPlanAtLeast(tier, p.plan_access as PlanTier);
              const isEnrolled = p.enrolment !== null;
              const totalHours = Math.round(p.totalMins / 60);
              return (
                <Link key={p.id} href={`/programs/${p.id}`}>
                  <Card className={`bg-surface border-border group relative flex h-full flex-col overflow-hidden p-0 transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/40 ${canAccess ? 'hover:border-accent/40' : 'opacity-80'}`}>
                    {/* Image with gradient overlay */}
                    <div className="relative h-44 overflow-hidden">
                      {p.cover_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.cover_image_url}
                          alt={p.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="bg-muted flex h-full w-full items-center justify-center">
                          <LayoutList className="text-text-dim h-10 w-10" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/20 to-transparent" />
                      {/* Top-left badges */}
                      <div className="absolute left-3 top-3 flex gap-1.5">
                        {p.category && (
                          <span className="bg-black/60 text-white backdrop-blur-sm rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                            Cat {p.category}
                          </span>
                        )}
                      </div>
                      {/* Top-right status */}
                      <div className="absolute right-3 top-3 flex gap-1.5">
                        {isEnrolled && (
                          <span className="bg-accent text-accent-fg rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                            Enrolled
                          </span>
                        )}
                        {!canAccess && (
                          <span className="bg-black/60 text-white backdrop-blur-sm flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                            <Lock className="h-2.5 w-2.5" />
                            {p.plan_access}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Body */}
                    <div className="flex flex-1 flex-col gap-3 p-5">
                      <div className="space-y-1.5">
                        <h3 className="text-text text-lg font-bold leading-snug transition-colors group-hover:text-accent/90">
                          {p.title}
                        </h3>
                        {p.description && (
                          <p className="text-text-muted line-clamp-2 text-sm leading-relaxed">{p.description}</p>
                        )}
                      </div>
                      {/* Stat tiles */}
                      <div className="border-border mt-auto grid grid-cols-3 gap-px overflow-hidden rounded-md border bg-border">
                        <div className="bg-surface flex flex-col items-center gap-0.5 py-2">
                          <Calendar className="text-text-dim h-3.5 w-3.5" />
                          <span className="text-text text-sm font-semibold">{p.weeksCount}</span>
                          <span className="text-text-dim text-[9px] uppercase tracking-wider">weeks</span>
                        </div>
                        <div className="bg-surface flex flex-col items-center gap-0.5 py-2">
                          <Dumbbell className="text-text-dim h-3.5 w-3.5" />
                          <span className="text-text text-sm font-semibold">{p.sessionsCount}</span>
                          <span className="text-text-dim text-[9px] uppercase tracking-wider">sessions</span>
                        </div>
                        <div className="bg-surface flex flex-col items-center gap-0.5 py-2">
                          <Clock className="text-text-dim h-3.5 w-3.5" />
                          <span className="text-text text-sm font-semibold">{totalHours || '—'}</span>
                          <span className="text-text-dim text-[9px] uppercase tracking-wider">{totalHours ? 'hours' : 'hrs'}</span>
                        </div>
                      </div>
                      {/* Progress bar (enrolled only) */}
                      {isEnrolled && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-text-dim flex items-center gap-1">
                              <CheckCircle2 className="text-accent h-3 w-3" />
                              Progress
                            </span>
                            <span className="text-accent font-bold">{p.progressPct}%</span>
                          </div>
                          <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
                            <div className="bg-accent h-full rounded-full transition-all" style={{ width: `${p.progressPct}%` }} />
                          </div>
                        </div>
                      )}
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
