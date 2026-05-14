import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, CheckCircle, Circle } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';

type WeekRow = { id: string; week_number: number; title: string; description: string | null };
type SessionRow = { id: string; session_number: number; title: string; estimated_duration_mins: number | null };
type CompletionRow = { session_id: string };

export default async function WeekDetailPage({ params }: { params: Promise<{ id: string; n: string }> }) {
  const { id, n } = await params;
  const weekNumber = parseInt(n);
  const { profile } = await requireUser();
  const supabase = await createSupabaseServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [weekRes, completionsRes] = await Promise.all([
    (supabase as any).from('program_weeks').select('id, week_number, title, description, program_sessions(id, session_number, title, estimated_duration_mins)').eq('program_id', id).eq('week_number', weekNumber).single() as Promise<{ data: (WeekRow & { program_sessions: SessionRow[] }) | null; error: unknown }>,
    supabase.from('user_session_completions').select('session_id').eq('user_id', profile.id).eq('program_id', id),
  ]);

  if (!weekRes.data) notFound();

  const week = weekRes.data;
  const completedIds = new Set(((completionsRes.data ?? []) as CompletionRow[]).map((c) => c.session_id));
  const sessions = [...(week.program_sessions ?? [])].sort((a, b) => a.session_number - b.session_number);

  return (
    <>
      <TopBar title={`Week ${week.week_number}: ${week.title}`} subtitle={`${completedIds.size} of ${sessions.length} sessions complete`} userTier={profile.subscription_tier} userName={profile.name} />
      <div className="max-w-lg space-y-4 p-4 sm:p-6 lg:p-8">
        <Link href={`/programs/${id}`} className="text-text-muted hover:text-text inline-flex items-center gap-1 text-sm"><ChevronLeft className="h-4 w-4" />Back to programme</Link>
        {week.description && <p className="text-text-muted text-sm leading-relaxed">{week.description}</p>}
        {sessions.map((sess) => {
          const done = completedIds.has(sess.id);
          return (
            <Link key={sess.id} href={`/programs/${id}/week/${weekNumber}/session/${sess.session_number}`}>
              <Card className={`bg-surface border-border hover:border-accent/40 flex items-center justify-between p-4 transition-all hover:-translate-y-0.5 ${done ? 'opacity-70' : ''}`}>
                <div className="flex items-center gap-3">
                  {done ? <CheckCircle className="text-accent h-5 w-5 shrink-0" /> : <Circle className="text-text-dim h-5 w-5 shrink-0" />}
                  <div>
                    <p className="text-text font-medium">Session {sess.session_number}: {sess.title}</p>
                    {sess.estimated_duration_mins && <p className="text-text-dim text-xs">{sess.estimated_duration_mins} min</p>}
                  </div>
                </div>
                <ChevronLeft className="text-text-dim h-4 w-4 rotate-180" />
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
