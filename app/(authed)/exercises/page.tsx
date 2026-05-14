import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import { Dumbbell } from 'lucide-react';
import { EXERCISE_IMAGES } from '@/lib/exercise-images';

export const metadata = { title: 'Exercise Library · Elevate Coaching' };

// Maps display label → DB muscle_group values (uses Supabase .overlaps())
const FILTERS = [
  { key: 'chest',      label: 'Chest',      values: ['chest', 'upper-chest'] },
  { key: 'back',       label: 'Back',        values: ['lats', 'rhomboids', 'lower-back', 'traps'] },
  { key: 'shoulders',  label: 'Shoulders',   values: ['front-delts', 'side-delts', 'rear-delts', 'rotator-cuff'] },
  { key: 'biceps',     label: 'Biceps',      values: ['biceps'] },
  { key: 'triceps',    label: 'Triceps',     values: ['triceps'] },
  { key: 'quads',      label: 'Quads',       values: ['quads'] },
  { key: 'hamstrings', label: 'Hamstrings',  values: ['hamstrings'] },
  { key: 'glutes',     label: 'Glutes',      values: ['glutes'] },
  { key: 'core',       label: 'Core',        values: ['core', 'lower-back'] },
];

type ExerciseRow = { id: string; title: string; description: string | null; muscle_groups: string[]; tags: string[] };

export default async function ExercisesPage({ searchParams }: { searchParams: Promise<{ muscle?: string }> }) {
  const sp = await searchParams;
  const { profile } = await requireUser();
  const supabase = await createSupabaseServerClient();

  const activeFilter = FILTERS.find((f) => f.key === sp.muscle) ?? null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any).from('exercises').select('id, title, description, muscle_groups, tags').order('title');
  if (activeFilter) query = query.overlaps('muscle_groups', activeFilter.values);

  const { data: raw } = await query;
  const exercises = (raw ?? []) as ExerciseRow[];

  return (
    <>
      <TopBar
        title="Exercise Library"
        subtitle={`${exercises.length} exercise${exercises.length !== 1 ? 's' : ''}${activeFilter ? ` · ${activeFilter.label}` : ''}`}
        userTier={profile.subscription_tier}
        userName={profile.name}
      />
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Filter bar */}
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link
            href="/exercises"
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              !sp.muscle
                ? 'bg-accent text-accent-fg'
                : 'bg-muted text-text-muted hover:bg-muted/80 hover:text-text'
            }`}
          >
            All
          </Link>
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={`/exercises?muscle=${f.key}`}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                sp.muscle === f.key
                  ? 'bg-accent text-accent-fg'
                  : 'bg-muted text-text-muted hover:bg-muted/80 hover:text-text'
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        {exercises.length === 0 && (
          <p className="text-text-muted py-16 text-center">No exercises found for this muscle group.</p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {exercises.map((ex) => {
            const img = EXERCISE_IMAGES[ex.title];
            return (
              <Link key={ex.id} href={`/exercises/${ex.id}`}>
                <Card className="bg-surface border-border hover:border-accent/40 group flex h-full flex-col overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/20">
                  {/* Image */}
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img}
                      alt={ex.title}
                      className="h-44 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="bg-muted flex h-44 w-full items-center justify-center">
                      <Dumbbell className="text-text-dim h-8 w-8" />
                    </div>
                  )}
                  {/* Content */}
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h3 className="text-text font-semibold leading-snug transition-colors group-hover:text-accent/90">
                      {ex.title}
                    </h3>
                    {ex.description && (
                      <p className="text-text-muted line-clamp-2 text-sm leading-relaxed">{ex.description}</p>
                    )}
                    {ex.muscle_groups.length > 0 && (
                      <div className="mt-auto flex flex-wrap gap-1 pt-1">
                        {ex.muscle_groups.slice(0, 3).map((mg) => (
                          <span key={mg} className="bg-muted text-text-dim rounded-sm px-1.5 py-0.5 text-[10px] font-medium capitalize">
                            {mg.replace(/-/g, ' ')}
                          </span>
                        ))}
                        {ex.muscle_groups.length > 3 && (
                          <span className="text-text-dim text-[10px]">+{ex.muscle_groups.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
