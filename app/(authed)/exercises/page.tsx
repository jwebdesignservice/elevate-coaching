import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import { Dumbbell } from 'lucide-react';

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

// Placeholder images per exercise title — admin can later add real images via edit form
const EXERCISE_IMAGES: Record<string, string> = {
  'Back Squat':            'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=480&h=260&fit=crop&auto=format',
  'Bench Press':           'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=480&h=260&fit=crop&auto=format',
  'Conventional Deadlift': 'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=480&h=260&fit=crop&auto=format',
  'Overhead Press':        'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=480&h=260&fit=crop&auto=format',
  'Barbell Row':           'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=480&h=260&fit=crop&auto=format',
  'Romanian Deadlift':     'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=480&h=260&fit=crop&auto=format',
  'Bulgarian Split Squat': 'https://images.unsplash.com/photo-1584466977773-e625c37cdd50?w=480&h=260&fit=crop&auto=format',
  'Dumbbell Lateral Raise':'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=480&h=260&fit=crop&auto=format',
  'Cable Row':             'https://images.unsplash.com/photo-1534258936925-c58bed479fcb?w=480&h=260&fit=crop&auto=format',
  'Leg Press':             'https://images.unsplash.com/photo-1576678927484-cc907957088c?w=480&h=260&fit=crop&auto=format',
  'Face Pull':             'https://images.unsplash.com/photo-1580261450046-d0a30080dc9b?w=480&h=260&fit=crop&auto=format',
  'Incline Dumbbell Press':'https://images.unsplash.com/photo-1546483875-ad9014c88eba?w=480&h=260&fit=crop&auto=format',
};

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
