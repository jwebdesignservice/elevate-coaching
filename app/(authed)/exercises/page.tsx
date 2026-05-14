import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import { Dumbbell } from 'lucide-react';

export const metadata = { title: 'Exercises · Elevate Coaching' };

const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core', 'Full Body',
];

type ExerciseRow = { id: string; title: string; description: string | null; muscle_groups: string[]; tags: string[] };

export default async function ExercisesPage({ searchParams }: { searchParams: Promise<{ muscle?: string }> }) {
  const sp = await searchParams;
  const { profile } = await requireUser();
  const supabase = await createSupabaseServerClient();

  let query = supabase.from('exercises').select('id, title, description, muscle_groups, tags').order('title');
  if (sp.muscle) query = query.contains('muscle_groups', [sp.muscle]);

  const { data: raw } = await query;
  const exercises = (raw ?? []) as ExerciseRow[];

  return (
    <>
      <TopBar title="Exercise Library" subtitle={`${exercises.length} exercise${exercises.length !== 1 ? 's' : ''}`} userTier={profile.subscription_tier} userName={profile.name} />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-wrap gap-2">
          <Link href="/exercises" className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${!sp.muscle ? 'bg-accent text-accent-fg' : 'bg-muted text-text-muted hover:text-text'}`}>All</Link>
          {MUSCLE_GROUPS.map((mg) => (
            <Link key={mg} href={`/exercises?muscle=${encodeURIComponent(mg)}`} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${sp.muscle === mg ? 'bg-accent text-accent-fg' : 'bg-muted text-text-muted hover:text-text'}`}>{mg}</Link>
          ))}
        </div>
        {exercises.length === 0 && <p className="text-text-muted py-12 text-center">No exercises found.</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {exercises.map((ex) => (
            <Link key={ex.id} href={`/exercises/${ex.id}`}>
              <Card className="bg-surface border-border hover:border-accent/40 group flex h-full flex-col gap-3 p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20">
                <div className="bg-accent/15 w-fit rounded-md p-2"><Dumbbell className="text-accent h-4 w-4" /></div>
                <h3 className="text-text font-semibold leading-snug transition-colors group-hover:text-accent/90">{ex.title}</h3>
                {ex.description && <p className="text-text-muted line-clamp-2 text-sm leading-relaxed">{ex.description}</p>}
                {ex.muscle_groups.length > 0 && (
                  <div className="mt-auto flex flex-wrap gap-1">
                    {ex.muscle_groups.slice(0, 3).map((mg) => (
                      <span key={mg} className="bg-muted text-text-dim rounded-sm px-1.5 py-0.5 text-[10px] font-medium">{mg}</span>
                    ))}
                    {ex.muscle_groups.length > 3 && <span className="text-text-dim text-[10px]">+{ex.muscle_groups.length - 3}</span>}
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
