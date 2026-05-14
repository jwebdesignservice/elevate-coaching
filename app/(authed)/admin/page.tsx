import Link from 'next/link';
import {
  CalendarDays,
  Dumbbell,
  LayoutList,
  Users,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import { requireCoach } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { buttonVariants } from '@/components/ui/button';

export const metadata = { title: 'Admin · Elevate Coaching' };

type ProgramRow = { status: string };

export default async function AdminPage() {
  const { profile } = await requireCoach();
  const supabase = await createSupabaseServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const [exCountRes, progRowsRes, userCountRes, completionCountRes] = await Promise.all([
    supabase.from('exercises').select('id', { count: 'exact', head: true }),
    sb.from('programs').select('status') as Promise<{ data: ProgramRow[] | null; error: unknown }>,
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('user_session_completions').select('id', { count: 'exact', head: true }),
  ]);

  const exerciseCount = exCountRes.count ?? 0;
  const programs = (progRowsRes.data ?? []) as ProgramRow[];
  const activeProgrammes = programs.filter((p) => p.status === 'active').length;
  const draftProgrammes = programs.filter((p) => p.status === 'draft').length;
  const totalProgrammes = programs.length;
  const userCount = userCountRes.count ?? 0;
  const completionCount = completionCountRes.count ?? 0;

  const firstName = profile.name?.split(' ')[0] ?? 'Coach';

  const tiles = [
    {
      href: '/admin/exercises',
      Icon: Dumbbell,
      title: 'Exercise Library',
      description: 'Build the global exercise catalogue — descriptions, muscle groups, video tutorials.',
      stat: `${exerciseCount} exercise${exerciseCount === 1 ? '' : 's'}`,
      accentBg: 'from-accent/20 to-accent/5',
    },
    {
      href: '/admin/programs',
      Icon: LayoutList,
      title: 'Programmes',
      description: 'Author week-by-week training journeys for each category.',
      stat: `${activeProgrammes} live · ${draftProgrammes} draft`,
      accentBg: 'from-blue-500/20 to-blue-500/5',
    },
    {
      href: '/admin/tasks',
      Icon: CalendarDays,
      title: 'Daily Tasks',
      description: 'Schedule the weekly accountability batch for each training category.',
      stat: 'Mon → Sun',
      accentBg: 'from-violet-500/20 to-violet-500/5',
    },
  ];

  return (
    <>
      <TopBar
        title="Coach Control Panel"
        subtitle="Manage exercises, programmes and daily tasks"
        userTier={profile.subscription_tier}
        userName={profile.name}
      />
      <div className="space-y-8 p-4 sm:p-6 lg:p-8">
        {/* Personal hero */}
        <section className="space-y-2">
          <p className="text-text-dim text-xs font-medium uppercase tracking-[0.18em]">
            <Sparkles className="mr-1.5 inline h-3 w-3" />
            Coach console, {firstName}
          </p>
          <h1 className="text-text text-3xl font-bold tracking-tight sm:text-4xl">
            Build the experience.
          </h1>
          <p className="text-text-muted max-w-xl text-sm">
            You&apos;re running the coach side of Elevate. Everything members see — programmes, exercises, daily tasks — is authored here.
          </p>
        </section>

        {/* Stats overview */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile icon={Dumbbell}   value={exerciseCount}     label="Exercises" />
          <StatTile icon={LayoutList} value={totalProgrammes}   label="Programmes" sub={activeProgrammes > 0 ? `${activeProgrammes} active` : 'none active'} />
          <StatTile icon={Users}      value={userCount}         label="Members" />
          <StatTile icon={TrendingUp} value={completionCount}   label="Sessions completed" sub="all-time" />
        </section>

        {/* Main areas */}
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <h2 className="text-text text-lg font-semibold">Manage</h2>
            <Link href="/admin/exercises/new" className={buttonVariants({ variant: 'outline', className: 'text-xs' })}>
              <Plus className="mr-1 h-3 w-3" />
              Quick add exercise
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {tiles.map(({ href, Icon, title, description, stat, accentBg }) => (
              <Link key={href} href={href}>
                <Card className="bg-surface border-border hover:border-accent/40 group relative flex h-full flex-col gap-4 overflow-hidden p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/30">
                  {/* Soft gradient corner */}
                  <div className={`pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br ${accentBg} blur-2xl`} />
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="bg-accent/15 text-accent rounded-md p-2.5">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-text-dim text-[10px] font-semibold uppercase tracking-wider">{stat}</span>
                  </div>
                  <div className="relative space-y-1">
                    <h2 className="text-text text-lg font-bold leading-tight">{title}</h2>
                    <p className="text-text-muted text-sm leading-relaxed">{description}</p>
                  </div>
                  <div className="relative mt-auto flex items-center gap-1 pt-2">
                    <span className="text-accent text-xs font-semibold">Open</span>
                    <ArrowRight className="text-accent group-hover:translate-x-0.5 h-3 w-3 transition-transform" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>

      </div>
    </>
  );
}

function StatTile({ icon: Icon, value, label, sub }: { icon: React.ComponentType<{ className?: string }>; value: number | string; label: string; sub?: string }) {
  return (
    <div className="bg-surface border-border flex flex-col gap-1 rounded-md border p-4">
      <Icon className="text-accent h-4 w-4" />
      <span className="text-text text-2xl font-bold leading-none">{value}</span>
      <span className="text-text-dim text-[10px] font-medium uppercase tracking-wider">{label}</span>
      {sub && <span className="text-text-muted text-[10px] mt-0.5">{sub}</span>}
    </div>
  );
}

