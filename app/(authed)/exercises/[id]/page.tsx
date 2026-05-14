import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Dumbbell, Video } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import type { MaxLifts } from '@/lib/lifts';

type ExerciseRow = { id: string; title: string; description: string | null; video_url: string | null; muscle_groups: string[]; tags: string[] };

export default async function ExerciseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: raw } = await supabase.from('exercises').select('id, title, description, video_url, muscle_groups, tags').eq('id', id).single();
  if (!raw) notFound();

  const ex = raw as ExerciseRow;
  const lifts = profile as unknown as MaxLifts;
  const liftDisplay = [
    { label: 'Squat', value: lifts.max_lift_squat },
    { label: 'Bench', value: lifts.max_lift_bench },
    { label: 'Deadlift', value: lifts.max_lift_deadlift },
    { label: 'OHP', value: lifts.max_lift_ohp },
  ];

  return (
    <>
      <TopBar title={ex.title} subtitle={ex.muscle_groups.join(' · ') || 'Exercise'} userTier={profile.subscription_tier} userName={profile.name} />
      <div className="max-w-2xl space-y-6 p-4 sm:p-6 lg:p-8">
        <Link href="/exercises" className="text-text-muted hover:text-text inline-flex items-center gap-1 text-sm"><ChevronLeft className="h-4 w-4" />Back to library</Link>
        <Card className="bg-surface border-border space-y-4 p-6">
          <div className="flex items-center gap-3">
            <div className="bg-accent/15 rounded-md p-2.5"><Dumbbell className="text-accent h-5 w-5" /></div>
            <h1 className="text-text text-2xl font-bold">{ex.title}</h1>
          </div>
          {ex.description && <p className="text-text-muted leading-relaxed">{ex.description}</p>}
          {ex.muscle_groups.length > 0 && (
            <div>
              <p className="text-text-dim mb-2 text-xs font-semibold uppercase tracking-wider">Muscles</p>
              <div className="flex flex-wrap gap-1.5">{ex.muscle_groups.map((mg) => <span key={mg} className="bg-accent/10 text-accent rounded-sm px-2 py-0.5 text-xs font-medium">{mg}</span>)}</div>
            </div>
          )}
          {ex.tags.length > 0 && <div className="flex flex-wrap gap-1.5">{ex.tags.map((tag) => <span key={tag} className="bg-muted text-text-muted rounded-sm px-2 py-0.5 text-xs">{tag}</span>)}</div>}
          {ex.video_url ? (
            <a href={ex.video_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent/80 inline-flex items-center gap-1.5 text-sm font-medium"><Video className="h-4 w-4" />Watch tutorial</a>
          ) : (
            <p className="text-text-dim text-xs italic">Video tutorial — coming soon.</p>
          )}
        </Card>
        <Card className="bg-surface border-border p-6">
          <h2 className="text-text mb-3 font-semibold">Your 1RM reference</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {liftDisplay.map(({ label, value }) => (
              <div key={label} className="bg-muted/50 rounded-md px-3 py-2 text-center">
                <p className="text-text-dim text-[10px] font-medium uppercase tracking-wider">{label}</p>
                <p className="text-text mt-1 text-lg font-bold">{value != null ? `${value} kg` : '—'}</p>
              </div>
            ))}
          </div>
          <p className="text-text-dim mt-3 text-xs">Update your max lifts in <Link href="/settings" className="text-accent hover:underline">Settings</Link>.</p>
        </Card>
      </div>
    </>
  );
}
