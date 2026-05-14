import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { requireCoach } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import { getMondayOf, toIsoDate } from '@/lib/tasks';

export const metadata = { title: 'Past Weeks · Daily Tasks · Admin' };

const PAGE_SIZE = 20;

interface PastWeekRow {
  id: string;
  category: 'A' | 'B' | 'C' | 'D';
  start_date: string;
  daily_tasks: { count: number }[];
}

export default async function AdminTasksPastPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { profile } = await requireCoach();
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const thisMondayIso = toIsoDate(getMondayOf(new Date()));

  const supabase = await createSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: weeksRaw } = await sb
    .from('task_weeks')
    .select('id, category, start_date, daily_tasks(count)')
    .lt('start_date', thisMondayIso)
    .order('start_date', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);
  const weeks = (weeksRaw ?? []) as PastWeekRow[];

  return (
    <>
      <TopBar
        title="Past Weeks"
        subtitle="Read-only — completions are settled"
        userTier={profile.subscription_tier}
        userName={profile.name}
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <Link
          href="/admin/tasks"
          className="text-text-muted hover:text-text mb-6 inline-flex items-center gap-1 text-sm"
        >
          <ChevronLeft className="h-4 w-4" /> Back to scheduler
        </Link>

        <Card className="bg-surface border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="text-text-muted px-4 py-3 text-left font-medium">Category</th>
                <th className="text-text-muted px-4 py-3 text-left font-medium">Week of</th>
                <th className="text-text-muted px-4 py-3 text-right font-medium">Tasks</th>
              </tr>
            </thead>
            <tbody>
              {weeks.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-text-muted px-4 py-8 text-center">
                    No past weeks yet.
                  </td>
                </tr>
              )}
              {weeks.map((w) => (
                <tr key={w.id} className="border-border border-b last:border-0">
                  <td className="text-text px-4 py-3 font-medium">Category {w.category}</td>
                  <td className="text-text-muted px-4 py-3">
                    {new Date(w.start_date + 'T00:00:00').toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="text-text-muted px-4 py-3 text-right">
                    {w.daily_tasks?.[0]?.count ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="mt-4 flex justify-between text-sm">
          {page > 1 ? (
            <Link
              href={`/admin/tasks/past?page=${page - 1}`}
              className="text-text-muted hover:text-text"
            >
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          {weeks.length === PAGE_SIZE ? (
            <Link
              href={`/admin/tasks/past?page=${page + 1}`}
              className="text-text-muted hover:text-text"
            >
              Older →
            </Link>
          ) : (
            <span />
          )}
        </div>
      </div>
    </>
  );
}
