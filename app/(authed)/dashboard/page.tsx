import {
  Activity,
  Bookmark,
  Brain,
  Dumbbell,
  Flame,
  HeartPulse,
  LineChart,
  TrendingUp,
  UtensilsCrossed,
  Waves,
  Zap,
} from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CATEGORY_INFO, type Category } from '@/lib/categories';
import { programProgressPct } from '@/lib/programs';
import { CircularProgress } from '@/components/charts/CircularProgress';
import { MiniBars } from '@/components/charts/MiniBars';
import { TopBar } from '@/components/layout/TopBar';
import { RightRail } from '@/components/layout/RightRail';
import { ProgramHero } from '@/components/branded/ProgramHero';
import { StatCard } from '@/components/branded/StatCard';
import { VideoTutorialCard } from '@/components/branded/VideoTutorialCard';
import { TodaysTasks, type TaskItem } from '@/components/dashboard/TodaysTasks';
import { WeeklySchedule, type ScheduleItem } from '@/components/dashboard/WeeklySchedule';
import { PerformanceOverview } from '@/components/dashboard/PerformanceOverview';

export const metadata = {
  title: 'Dashboard · Elevate Coaching',
};

// ─────────────────────────────────────────────────────────────────────────
// DEMO DATA — visual fidelity for SP-1.
// Replace with real fetches when their respective sprints ship:
//   • current program        → SP-5
//   • stat-card values + charts → SP-4
//   • video tutorials        → SP-6
//   • today's tasks          → SP-4
//   • weekly schedule        → SP-4
//   • performance series     → SP-4
// ─────────────────────────────────────────────────────────────────────────

const DEMO_TASKS: TaskItem[] = [
  { label: 'Complete Lower Body Workout', done: true },
  { label: 'Watch Video: Mobility & Recovery', done: true },
  { label: 'Log Nutrition', done: false },
  { label: '10,000 Steps', done: false },
  { label: 'Cold Shower', done: false },
  { label: 'Evening Mindset Journal', done: false },
];

const DEMO_DAYS = [
  { letter: 'M', date: 19 },
  { letter: 'T', date: 20 },
  { letter: 'W', date: 21 },
  { letter: 'T', date: 22 },
  { letter: 'F', date: 23 },
  { letter: 'S', date: 24 },
  { letter: 'S', date: 25 },
];

const DEMO_SCHEDULE: ScheduleItem[] = [
  { Icon: Dumbbell, label: 'Lower Body Strength', time: '8:00 AM' },
  { Icon: HeartPulse, label: 'Conditioning', time: '12:00 PM' },
  { Icon: Waves, label: 'Mobility & Recovery', time: '6:00 PM' },
];

const DEMO_PERFORMANCE = {
  '7D': {
    value: '712',
    delta: '+3% vs last 7 days',
    data: [690, 695, 692, 700, 705, 708, 712],
  },
  '30D': {
    value: '725',
    delta: '+8% vs last 30 days',
    data: [670, 668, 675, 680, 678, 685, 690, 692, 695, 700, 698, 705, 710, 715, 720, 725],
  },
  '90D': {
    value: '748',
    delta: '+14% vs last 90 days',
    data: [650, 655, 660, 665, 670, 678, 685, 690, 695, 700, 710, 718, 725, 732, 740, 748],
  },
};

const DEMO_VIDEOS = [
  {
    title: 'Lower Body Strength',
    description: 'Build a powerful foundation.',
    duration: '12:45',
    Icon: Dumbbell,
    gradient: 'from-zinc-700 via-zinc-900 to-black',
  },
  {
    title: 'Upper Body Power',
    description: 'Increase strength & explosiveness.',
    duration: '14:23',
    Icon: Zap,
    gradient: 'from-zinc-800 via-zinc-900 to-black',
  },
  {
    title: 'Conditioning & Endurance',
    description: 'Boost your engine and stamina.',
    duration: '10:12',
    Icon: Activity,
    gradient: 'from-slate-700 via-slate-900 to-black',
  },
  {
    title: 'Mobility & Recovery',
    description: 'Move better, recover faster.',
    duration: '08:36',
    Icon: Waves,
    gradient: 'from-zinc-700 via-zinc-900 to-black',
  },
  {
    title: 'Mindset Mastery',
    description: 'Train your mind for success.',
    duration: '09:15',
    Icon: Brain,
    gradient: 'from-zinc-800 via-zinc-900 to-black',
  },
  {
    title: 'Nutrition Essentials',
    description: 'Fuel your body the right way.',
    duration: '11:07',
    Icon: UtensilsCrossed,
    gradient: 'from-stone-700 via-stone-900 to-black',
  },
  {
    title: 'Advanced Lifts',
    description: 'Level up your performance.',
    duration: '13:50',
    Icon: Dumbbell,
    gradient: 'from-zinc-700 via-zinc-900 to-black',
  },
  {
    title: 'HIIT Workouts',
    description: 'High intensity. Maximum results.',
    duration: '10:35',
    Icon: Flame,
    gradient: 'from-zinc-800 via-zinc-900 to-black',
  },
  {
    title: 'Recovery & Wellness',
    description: 'Recharge and come back stronger.',
    duration: '07:58',
    Icon: HeartPulse,
    gradient: 'from-slate-700 via-slate-900 to-black',
  },
];

export default async function DashboardPage() {
  const { profile } = await requireUser();
  const firstName = profile.name?.split(/\s+/)[0]?.trim() || 'there';
  const category = profile.category as Category;
  const categoryInfo = CATEGORY_INFO[category];
  const supabase = await createSupabaseServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const enrolmentRes = await (sb
    .from('user_program_enrollments')
    .select('program_id, current_week_number, programs(title, program_weeks(id))')
    .eq('user_id', profile.id)
    .order('enrolled_at', { ascending: false })
    .limit(1)
    .maybeSingle() as Promise<{ data: { program_id: string; current_week_number: number; programs: { title: string; program_weeks: { id: string }[] } | null } | null; error: unknown }>);

  const { count: totalSessionsDone } = await supabase
    .from('user_session_completions')
    .select('session_id', { count: 'exact', head: true })
    .eq('user_id', profile.id);

  const enrolment = enrolmentRes.data ?? null;

  let heroTitle = 'Start a programme';
  let heroMeta = 'Explore the programme library to begin your journey.';
  let heroPct = 0;
  let programProgressValue = 0;
  let primaryCta = { label: 'Browse programmes', href: '/programs' };
  const secondaryCta = { label: 'View exercises', href: '/exercises' };

  if (enrolment?.programs) {
    const prog = enrolment.programs;
    const totalWeeks = prog.program_weeks?.length ?? 0;
    heroTitle = prog.title;
    heroMeta = `Week ${enrolment.current_week_number} of ${totalWeeks} · ${categoryInfo.name}`;
    heroPct = programProgressPct(totalWeeks, enrolment.current_week_number - 1);
    programProgressValue = heroPct;
    primaryCta = { label: 'Continue programme', href: `/programs/${enrolment.program_id}` };
  }

  const sessionsDone = totalSessionsDone ?? 0;

  return (
    <>
      <TopBar
        title={`Welcome back, ${firstName} 👋`}
        subtitle="Ready to elevate your performance today?"
        userTier={profile.subscription_tier}
        userName={profile.name}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <ProgramHero
            eyebrow={`Category ${category} · ${categoryInfo.name}`}
            title={heroTitle}
            meta={heroMeta}
            progressPct={heroPct}
            primary={primaryCta}
            secondary={secondaryCta}
          />

          {/* Stat row */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              label="Programme Progress"
              value={`${programProgressValue}%`}
              caption={enrolment ? 'Current programme' : 'No programme started'}
              captionTone={enrolment ? 'accent' : 'muted'}
              visual={<CircularProgress value={programProgressValue} size={48} strokeWidth={4} label={`${programProgressValue}%`} />}
            />
            <StatCard
              icon={<Dumbbell className="h-3.5 w-3.5" />}
              label="Sessions Done"
              value={String(sessionsDone)}
              caption="All time"
              captionTone="muted"
              visual={<CircularProgress value={Math.min(sessionsDone * 5, 100)} size={48} strokeWidth={4} label={String(sessionsDone)} />}
            />
            <StatCard
              icon={<Flame className="h-3.5 w-3.5" />}
              label="Active Streak"
              value="—"
              caption="Coming in SP-5"
              captionTone="muted"
              visual={<MiniBars data={[1, 1, 1, 1, 1, 1, 1]} />}
            />
            <StatCard
              icon={<Bookmark className="h-3.5 w-3.5" />}
              label="Tasks Done"
              value="—"
              caption="Coming in SP-5"
              captionTone="muted"
              visual={<CircularProgress value={0} size={48} strokeWidth={4} label="—" />}
            />
          </div>

          {/* Video Tutorials */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-text text-xl font-semibold tracking-tight">Video Tutorials</h2>
              <a
                href="#"
                className="text-accent inline-flex items-center gap-1 text-sm font-medium hover:underline"
              >
                View All Videos
                <LineChart className="h-3.5 w-3.5" />
              </a>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {DEMO_VIDEOS.map((v, i) => (
                <VideoTutorialCard
                  key={v.title}
                  index={i + 1}
                  title={v.title}
                  description={v.description}
                  duration={v.duration}
                  Icon={v.Icon}
                  gradient={v.gradient}
                />
              ))}
            </div>
          </section>
        </div>

        <RightRail>
          <TodaysTasks tasks={DEMO_TASKS} />
          <WeeklySchedule days={DEMO_DAYS} activeDayIndex={3} items={DEMO_SCHEDULE} />
          <PerformanceOverview
            metricLabel="Strength Score"
            series={DEMO_PERFORMANCE}
            defaultPeriod="30D"
          />
        </RightRail>
      </div>
    </>
  );
}
