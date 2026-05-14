import Link from 'next/link';
import { ChevronLeft, Plus } from 'lucide-react';
import { requireCoach } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import { CATEGORY_INFO, type Category } from '@/lib/categories';
import { getMondayOf, toIsoDate } from '@/lib/tasks';
import type { TaskType } from '@/lib/task-types';
import { createDraftWeekAction } from './actions';
import { DayDrawer } from './day-drawer';

export const metadata = { title: 'Daily Tasks · Admin · Elevate Coaching' };

const CATEGORIES: Category[] = ['A', 'B', 'C', 'D'];
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

interface WeekShape {
  id: string;
  category: Category;
  start_date: string;
  daily_tasks: {
    id: string;
    day_of_week: number;
    task_type: TaskType;
    title: string;
    order_index: number;
  }[];
}

export default async function AdminTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; day?: string; col?: string }>;
}) {
  const { profile } = await requireCoach();
  const params = await searchParams;
  const activeCat: Category = CATEGORIES.includes(params.cat as Category)
    ? (params.cat as Category)
    : 'A';

  const today = new Date();
  const todayIso = toIsoDate(today);
  const thisMonday = getMondayOf(today);
  const nextMonday = new Date(thisMonday);
  nextMonday.setDate(thisMonday.getDate() + 7);
  const thisMondayIso = toIsoDate(thisMonday);
  const nextMondayIso = toIsoDate(nextMonday);

  const supabase = await createSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: weeksRaw } = await sb
    .from('task_weeks')
    .select('id, category, start_date, daily_tasks(id, day_of_week, task_type, title, order_index)')
    .eq('category', activeCat)
    .in('start_date', [thisMondayIso, nextMondayIso]);
  const weeks = (weeksRaw ?? []) as WeekShape[];

  const liveWeek = weeks.find((w) => w.start_date === thisMondayIso) ?? null;
  const draftWeek = weeks.find((w) => w.start_date === nextMondayIso) ?? null;

  // Drawer open state from URL.
  const drawerDayIdx = params.day
    ? DAY_NAMES.indexOf(params.day as (typeof DAY_NAMES)[number])
    : -1;
  const drawerDay = drawerDayIdx >= 0 ? drawerDayIdx + 1 : 0;
  const drawerCol = params.col === 'draft' ? 'draft' : 'live';
  const drawerWeek = drawerCol === 'draft' ? draftWeek : liveWeek;
  const drawerOpen = drawerDay > 0 && !!drawerWeek;
  const drawerTasks = drawerOpen
    ? drawerWeek!.daily_tasks
        .filter((t) => t.day_of_week === drawerDay)
        .sort((a, b) => a.order_index - b.order_index)
    : [];
  const todayDow = isoDayOfWeekFromIso(todayIso);

  return (
    <>
      <TopBar
        title="Daily Tasks"
        subtitle={`Scheduler for category ${activeCat}`}
        userTier={profile.subscription_tier}
        userName={profile.name}
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <Link
          href="/admin"
          className="text-text-muted hover:text-text mb-6 inline-flex items-center gap-1 text-sm"
        >
          <ChevronLeft className="h-4 w-4" />Back to admin
        </Link>
        {/* Category tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const active = c === activeCat;
            return (
              <Link
                key={c}
                href={`/admin/tasks?cat=${c}`}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-accent text-accent-fg'
                    : 'bg-surface text-text-muted border-border hover:text-text border'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                Category {c} · {CATEGORY_INFO[c].name}
              </Link>
            );
          })}
        </div>

        {/* Live + Draft columns */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="bg-surface border-border p-5">
            <h2 className="text-text mb-4 font-semibold">
              <span className="text-accent">●</span> Live · Week of {formatMonDay(thisMondayIso)}
            </h2>
            {liveWeek ? (
              <DayList
                weekTasks={liveWeek.daily_tasks}
                activeCat={activeCat}
                col="live"
                todayDow={todayDow}
              />
            ) : (
              <p className="text-text-muted text-sm">
                No live week — create one for next Monday in the draft column.
              </p>
            )}
          </Card>

          <Card className="bg-surface border-border p-5">
            <h2 className="text-text mb-4 font-semibold">
              <span className="text-amber-400">○</span> Draft · Week of {formatMonDay(nextMondayIso)}
            </h2>
            {draftWeek ? (
              <DayList
                weekTasks={draftWeek.daily_tasks}
                activeCat={activeCat}
                col="draft"
                todayDow={null}
              />
            ) : (
              <form action={createDraftWeekAction}>
                <input type="hidden" name="category" value={activeCat} />
                <input type="hidden" name="start_date" value={nextMondayIso} />
                <button
                  type="submit"
                  className="bg-accent text-accent-fg hover:bg-accent/80 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium"
                >
                  <Plus className="h-4 w-4" /> Create draft week
                </button>
              </form>
            )}
          </Card>
        </div>

        <div className="mt-6">
          <Link href="/admin/tasks/past" className="text-text-muted hover:text-text text-sm">
            View past weeks →
          </Link>
        </div>

        {drawerOpen && drawerWeek && (
          <DayDrawer
            weekId={drawerWeek.id}
            dayOfWeek={drawerDay}
            dayLabel={`${DAY_NAMES[drawerDay - 1]} · ${formatMonDay(addDays(drawerWeek.start_date, drawerDay - 1))} · Category ${activeCat}`}
            tasks={drawerTasks}
            readOnly={false}
            closeHref={`/admin/tasks?cat=${activeCat}`}
          />
        )}
      </div>
    </>
  );
}

function formatMonDay(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isoDayOfWeekFromIso(iso: string): number {
  const d = new Date(iso + 'T00:00:00');
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

interface DayListProps {
  weekTasks: WeekShape['daily_tasks'];
  activeCat: Category;
  col: 'live' | 'draft';
  todayDow: number | null;
}

function DayList({ weekTasks, activeCat, col, todayDow }: DayListProps) {
  return (
    <ul className="space-y-1">
      {DAY_NAMES.map((name, i) => {
        const dow = i + 1;
        const count = weekTasks.filter((t) => t.day_of_week === dow).length;
        const isToday = todayDow === dow;
        return (
          <li key={name}>
            <Link
              href={`/admin/tasks?cat=${activeCat}&col=${col}&day=${name}`}
              className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-white/[0.04]"
            >
              <span className="text-text flex items-center gap-2">
                {name}
                {isToday && (
                  <span className="bg-accent text-accent-fg rounded-full px-1.5 text-[10px] font-semibold">
                    today
                  </span>
                )}
              </span>
              <span className="text-text-muted text-xs">
                {count} task{count === 1 ? '' : 's'}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
