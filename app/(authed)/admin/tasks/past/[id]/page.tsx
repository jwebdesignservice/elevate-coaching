import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { requireCoach } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import { type Category } from '@/lib/categories';
import type { TaskType } from '@/lib/task-types';
import { DayDrawer } from '../../day-drawer';

export const metadata = { title: 'Past Week · Daily Tasks · Admin' };

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

interface PastWeekShape {
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

export default async function AdminTasksPastWeekPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const { profile } = await requireCoach();
  const { id } = await params;
  const { day } = await searchParams;

  const supabase = await createSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: weekRaw } = await sb
    .from('task_weeks')
    .select('id, category, start_date, daily_tasks(id, day_of_week, task_type, title, order_index)')
    .eq('id', id)
    .maybeSingle();
  const week = (weekRaw ?? null) as PastWeekShape | null;
  if (!week) notFound();

  const drawerDayIdx = day ? DAY_NAMES.indexOf(day as (typeof DAY_NAMES)[number]) : -1;
  const drawerDay = drawerDayIdx >= 0 ? drawerDayIdx + 1 : 0;
  const drawerOpen = drawerDay > 0;
  const drawerTasks = drawerOpen
    ? week.daily_tasks
        .filter((t) => t.day_of_week === drawerDay)
        .sort((a, b) => a.order_index - b.order_index)
    : [];

  const weekOfLabel = new Date(week.start_date + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <>
      <TopBar
        title={`Week of ${weekOfLabel}`}
        subtitle={`Category ${week.category} · read-only`}
        userTier={profile.subscription_tier}
        userName={profile.name}
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <Link
          href="/admin/tasks/past"
          className="text-text-muted hover:text-text mb-6 inline-flex items-center gap-1 text-sm"
        >
          <ChevronLeft className="h-4 w-4" /> Back to past weeks
        </Link>

        <Card className="bg-surface border-border mx-auto max-w-xl p-5">
          <h2 className="text-text mb-4 font-semibold">
            <span className="text-text-muted">●</span> Past · Week of {formatMonDay(week.start_date)}
          </h2>
          <ul className="space-y-1">
            {DAY_NAMES.map((name, i) => {
              const dow = i + 1;
              const count = week.daily_tasks.filter((t) => t.day_of_week === dow).length;
              return (
                <li key={name}>
                  <Link
                    href={`/admin/tasks/past/${week.id}?day=${name}`}
                    className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-white/[0.04]"
                  >
                    <span className="text-text">{name}</span>
                    <span className="text-text-muted text-xs">
                      {count} task{count === 1 ? '' : 's'}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>

        {drawerOpen && (
          <DayDrawer
            weekId={week.id}
            dayOfWeek={drawerDay}
            dayLabel={`${DAY_NAMES[drawerDay - 1]} · ${formatMonDay(addDays(week.start_date, drawerDay - 1))} · Category ${week.category} · Past`}
            tasks={drawerTasks}
            readOnly
            closeHref={`/admin/tasks/past/${week.id}`}
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
