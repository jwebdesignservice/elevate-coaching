import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ChevronLeft,
  CheckCircle2,
  Lock,
  Calendar,
  Dumbbell,
  Clock,
  Zap,
  Target,
  Trophy,
  ArrowRight,
  PlayCircle,
} from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { hasPlanAtLeast, type PlanTier } from '@/lib/plans';
import { programProgressPct } from '@/lib/programs';
import { enrollAction } from './actions';

type ProgramRow = {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  category: string | null;
  plan_access: string;
};
type SessionRow = { id: string; estimated_duration_mins: number | null };
type WeekRow = { id: string; week_number: number; title: string; description: string | null; program_sessions: SessionRow[] };
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
    sb.from('programs').select('id, title, description, cover_image_url, category, plan_access').eq('id', id).single() as Promise<{ data: ProgramRow | null; error: unknown }>,
    sb.from('program_weeks').select('id, week_number, title, description, program_sessions(id, estimated_duration_mins)').eq('program_id', id).order('week_number') as Promise<{ data: WeekRow[] | null; error: unknown }>,
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
  const allSessions = weeks.flatMap((w) => w.program_sessions ?? []);
  const totalSessions = allSessions.length;
  const totalMins = allSessions.reduce((s, x) => s + (x.estimated_duration_mins ?? 0), 0);
  const progressPct = programProgressPct(totalSessions, completedIds.size);
  const sessionsPerWeek = weeks.length > 0 ? Math.round(totalSessions / weeks.length) : 0;
  const avgSessionMins = totalSessions > 0 ? Math.round(totalMins / totalSessions) : 0;

  const enrol = enrollAction.bind(null, id);

  let continueHref = `/programs/${id}/week/1`;
  outer: for (const week of weeks) {
    for (const sess of (week.program_sessions ?? [])) {
      if (!completedIds.has(sess.id)) { continueHref = `/programs/${id}/week/${week.week_number}`; break outer; }
    }
  }

  return (
    <>
      <TopBar
        title={program.title}
        subtitle={isEnrolled ? `${progressPct}% complete · ${completedIds.size}/${totalSessions} sessions` : `${totalSessions} sessions · ${weeks.length} weeks`}
        userTier={profile.subscription_tier}
        userName={profile.name}
      />
      <div className="space-y-8 p-4 sm:p-6 lg:p-8">
        <Link href="/programs" className="text-text-muted hover:text-text inline-flex items-center gap-1 text-sm">
          <ChevronLeft className="h-4 w-4" />All programmes
        </Link>

        {/* Cinematic hero */}
        <Card className="bg-surface border-border relative overflow-hidden p-0">
          <div className="relative h-64 sm:h-80">
            {program.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={program.cover_image_url} alt={program.title} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="bg-muted absolute inset-0" />
            )}
            {/* Dark gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/70 to-surface/20" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2">
                {program.category && (
                  <span className="bg-black/60 text-white backdrop-blur-sm rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                    Category {program.category}
                  </span>
                )}
                <span className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                  program.plan_access === 'free'
                    ? 'bg-accent/20 text-accent'
                    : 'bg-black/60 text-white backdrop-blur-sm'
                }`}>
                  {program.plan_access === 'free' ? 'Free' : `${program.plan_access}+ plan`}
                </span>
                {isEnrolled && (
                  <span className="bg-accent text-accent-fg rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                    Enrolled
                  </span>
                )}
              </div>
              <h1 className="text-text mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                {program.title}
              </h1>
              {program.description && (
                <p className="text-text-muted mt-2 max-w-2xl text-sm leading-relaxed sm:text-base">
                  {program.description}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Stats + CTA grid */}
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          {/* Stats tiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile icon={Calendar} value={weeks.length} label="Weeks" />
            <StatTile icon={Dumbbell} value={totalSessions} label="Sessions" />
            <StatTile icon={Clock} value={`${Math.round(totalMins / 60) || '—'}h`} label="Total time" />
            <StatTile icon={Zap} value={`${avgSessionMins || '—'}m`} label="Avg session" />
          </div>

          {/* CTA card */}
          {!canAccess ? (
            <Card className="border-border bg-muted/30 flex flex-col justify-center gap-3 p-5">
              <div className="flex items-center gap-2">
                <Lock className="text-text-dim h-4 w-4" />
                <p className="text-text text-sm font-semibold">Requires {program.plan_access} plan</p>
              </div>
              <Link href="/pricing" className={buttonVariants({ className: 'bg-accent text-accent-fg hover:bg-accent/80 hover:text-white hover:border-accent w-fit' })}>
                Upgrade to unlock
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Card>
          ) : isEnrolled ? (
            <Card className="from-accent/15 border-border/0 ring-accent/30 flex flex-col justify-center gap-3 bg-gradient-to-br to-transparent p-5 ring-1">
              <div>
                <p className="text-accent text-[10px] font-bold uppercase tracking-wider">In progress</p>
                <p className="text-text mt-0.5 font-semibold">Week {enrolment?.current_week_number ?? 1} of {weeks.length}</p>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-text-muted">Overall progress</span>
                  <span className="text-accent font-bold">{progressPct}%</span>
                </div>
                <div className="bg-muted relative h-2 w-full overflow-hidden rounded-full">
                  <div
                    className="from-accent to-accent/60 absolute inset-y-0 left-0 rounded-full bg-gradient-to-r transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
              <Link href={continueHref} className={buttonVariants({ className: 'bg-accent text-accent-fg hover:bg-accent/80 hover:text-white hover:border-accent w-full' })}>
                <PlayCircle className="mr-1.5 h-4 w-4" />
                Continue programme
              </Link>
            </Card>
          ) : (
            <Card className="bg-surface border-border flex flex-col justify-center gap-3 p-5">
              <div className="flex items-center gap-2">
                <Trophy className="text-accent h-5 w-5" />
                <p className="text-text font-semibold">Ready to begin?</p>
              </div>
              <p className="text-text-muted text-xs">
                Start now and we&apos;ll track your progress week by week. You can pause anytime.
              </p>
              <form action={enrol}>
                <Button type="submit" className="bg-accent text-accent-fg hover:bg-accent/80 hover:text-white hover:border-accent w-full">
                  Start programme
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </form>
            </Card>
          )}
        </div>

        {/* What's inside */}
        {canAccess && (
          <Card className="bg-surface border-border p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Target className="text-accent h-4 w-4" />
              <h3 className="text-text font-semibold">What&apos;s inside</h3>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Bullet>
                <span className="text-text font-medium">{sessionsPerWeek} sessions/week</span>
                <span className="text-text-muted block text-xs">~{avgSessionMins} min each</span>
              </Bullet>
              <Bullet>
                <span className="text-text font-medium">Progressive overload</span>
                <span className="text-text-muted block text-xs">Volume & load builds weekly</span>
              </Bullet>
              <Bullet>
                <span className="text-text font-medium">1RM-driven weights</span>
                <span className="text-text-muted block text-xs">Auto-calculated from your stats</span>
              </Bullet>
            </div>
          </Card>
        )}

        {/* Programme weeks */}
        {canAccess && (
          <section className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-text text-lg font-semibold">Programme weeks</h2>
              <span className="text-text-dim text-xs">{weeks.length} weeks total</span>
            </div>
            <div className="flex flex-col gap-4">
              {weeks.map((week) => {
                const weekSessions = week.program_sessions ?? [];
                const weekDone = weekSessions.filter((s) => completedIds.has(s.id)).length;
                const weekPct = weekSessions.length > 0 ? Math.round((weekDone / weekSessions.length) * 100) : 0;
                const weekMins = weekSessions.reduce((s, x) => s + (x.estimated_duration_mins ?? 0), 0);
                const isCurrent = isEnrolled && enrolment?.current_week_number === week.week_number;
                const isComplete = weekDone === weekSessions.length && weekSessions.length > 0;
                return (
                  <Link key={week.id} href={`/programs/${id}/week/${week.week_number}`}>
                    <Card className={`group bg-surface border-border hover:border-accent/40 relative overflow-hidden p-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 ${isCurrent ? 'border-accent/40 ring-accent/20 ring-1' : ''}`}>
                      <div className="flex items-stretch">
                        {/* Week number block */}
                        <div className={`flex w-20 shrink-0 flex-col items-center justify-center gap-0.5 ${isComplete ? 'bg-accent/15' : isCurrent ? 'bg-accent/10' : 'bg-muted/40'}`}>
                          {isComplete ? (
                            <CheckCircle2 className="text-accent h-5 w-5" />
                          ) : (
                            <>
                              <span className="text-text-dim text-[10px] font-medium uppercase tracking-wider">Week</span>
                              <span className={`text-2xl font-bold ${isCurrent ? 'text-accent' : 'text-text'}`}>{week.week_number}</span>
                            </>
                          )}
                        </div>
                        {/* Body */}
                        <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <h3 className="text-text font-semibold leading-snug transition-colors group-hover:text-accent/90">
                                {week.title}
                              </h3>
                              {week.description && (
                                <p className="text-text-muted line-clamp-1 mt-0.5 text-xs leading-relaxed">{week.description}</p>
                              )}
                            </div>
                            {isCurrent && (
                              <span className="bg-accent/15 text-accent shrink-0 rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                                Current
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs">
                            <span className="text-text-muted flex items-center gap-1">
                              <Dumbbell className="text-text-dim h-3 w-3" />
                              {weekSessions.length} sessions
                            </span>
                            {weekMins > 0 && (
                              <span className="text-text-muted flex items-center gap-1">
                                <Clock className="text-text-dim h-3 w-3" />
                                {weekMins} min
                              </span>
                            )}
                            <span className="text-text-muted flex items-center gap-1">
                              <CheckCircle2 className={`h-3 w-3 ${isComplete ? 'text-accent' : 'text-text-dim'}`} />
                              {weekDone}/{weekSessions.length} done
                            </span>
                          </div>
                          {weekSessions.length > 0 && (
                            <div className="bg-muted relative mt-auto h-1 w-full overflow-hidden rounded-full">
                              <div
                                className={`absolute inset-y-0 left-0 rounded-full transition-all ${isComplete ? 'bg-accent' : 'bg-accent/60'}`}
                                style={{ width: `${weekPct}%` }}
                              />
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
        )}
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

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-border bg-muted/20 flex items-start gap-2 rounded-md border p-3">
      <CheckCircle2 className="text-accent mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  );
}
