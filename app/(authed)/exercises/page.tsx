import Link from 'next/link';
import { Dumbbell, Sparkles, ArrowRight } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import { exerciseImage } from '@/lib/exercise-images';

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

function exerciseType(tags: string[]): string | null {
  if (tags.includes('compound')) return 'Compound';
  if (tags.includes('isolation')) return 'Isolation';
  if (tags.includes('accessory')) return 'Accessory';
  return null;
}

function exerciseEquipment(tags: string[]): string | null {
  if (tags.includes('barbell')) return 'Barbell';
  if (tags.includes('dumbbell')) return 'Dumbbell';
  if (tags.includes('cable')) return 'Cable';
  if (tags.includes('machine')) return 'Machine';
  return null;
}

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
  const firstName = profile.name?.split(' ')[0] ?? 'there';

  return (
    <>
      <TopBar
        title="Exercise Library"
        subtitle={`${exercises.length} exercise${exercises.length !== 1 ? 's' : ''}${activeFilter ? ` · ${activeFilter.label}` : ''}`}
        userTier={profile.subscription_tier}
        userName={profile.name}
      />
      <div className="space-y-8 p-4 sm:p-6 lg:p-8">
        {/* Personal hero */}
        <section className="space-y-2">
          <p className="text-text-dim text-xs font-medium uppercase tracking-[0.18em]">
            <Sparkles className="mr-1.5 inline h-3 w-3" />
            Library, {firstName}
          </p>
          <h1 className="text-text text-3xl font-bold tracking-tight sm:text-4xl">Master every movement.</h1>
          <p className="text-text-muted max-w-xl text-sm">
            Browse every exercise in your programme — with form notes, target muscles and load references calibrated to your max lifts.
          </p>
        </section>

        {/* Filter bar */}
        <div>
          <p className="text-text-dim mb-2 text-[10px] font-bold uppercase tracking-wider">Filter by muscle group</p>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Link
              href="/exercises"
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                !sp.muscle
                  ? 'bg-accent text-accent-fg'
                  : 'bg-muted text-text-muted hover:bg-muted/80 hover:text-text'
              }`}
            >
              All ({exercises.length})
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
        </div>

        {/* Grid */}
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <h2 className="text-text text-lg font-semibold">
              {activeFilter ? activeFilter.label : 'All exercises'}
            </h2>
            <span className="text-text-dim text-xs">{exercises.length} shown</span>
          </div>

          {exercises.length === 0 && (
            <Card className="bg-surface border-border p-12 text-center">
              <Dumbbell className="text-text-dim mx-auto h-8 w-8" />
              <p className="text-text-muted mt-3 text-sm">No exercises found for this muscle group.</p>
              <Link href="/exercises" className="text-accent hover:underline mt-2 inline-flex items-center gap-1 text-xs">
                Clear filter <ArrowRight className="h-3 w-3" />
              </Link>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {exercises.map((ex) => {
              const img = exerciseImage(ex.title);
              const type = exerciseType(ex.tags);
              const equipment = exerciseEquipment(ex.tags);
              const primary = ex.muscle_groups[0];
              return (
                <Link key={ex.id} href={`/exercises/${ex.id}`}>
                  <Card className="bg-surface border-border hover:border-accent/40 group relative flex h-full flex-col overflow-hidden p-0 transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/40">
                    {/* Image with gradient overlay */}
                    <div className="relative h-44 overflow-hidden transform-gpu">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img}
                        alt={ex.title}
                        className="absolute inset-0 block h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface via-surface/10 to-transparent" />
                      {/* Badges */}
                      <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                        {type && (
                          <span className="bg-black/60 text-white backdrop-blur-sm rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                            {type}
                          </span>
                        )}
                        {equipment && (
                          <span className="bg-black/60 text-white backdrop-blur-sm rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                            {equipment}
                          </span>
                        )}
                      </div>
                      {primary && (
                        <span className="bg-accent/90 text-accent-fg absolute right-3 top-3 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider capitalize backdrop-blur-sm">
                          {primary.replace(/-/g, ' ')}
                        </span>
                      )}
                    </div>

                    {/* Body */}
                    <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
                      <h3 className="text-text text-lg font-bold leading-snug transition-colors group-hover:text-accent/90">
                        {ex.title}
                      </h3>
                      {ex.description && (
                        <p className="text-text-muted line-clamp-2 text-sm leading-relaxed">{ex.description}</p>
                      )}
                      {/* Muscle group chips footer */}
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                          {ex.muscle_groups.slice(0, 3).map((mg) => (
                            <span key={mg} className="text-text-dim text-[11px] capitalize">
                              {mg.replace(/-/g, ' ')}
                            </span>
                          )).reduce<React.ReactNode[]>((acc, el, idx) => {
                            if (idx > 0) acc.push(<span key={`d-${idx}`} className="text-text-dim text-[11px]">·</span>);
                            acc.push(el);
                            return acc;
                          }, [])}
                          {ex.muscle_groups.length > 3 && (
                            <span className="text-text-dim text-[11px]">+{ex.muscle_groups.length - 3}</span>
                          )}
                        </div>
                        <ArrowRight className="text-text-dim group-hover:text-accent h-3.5 w-3.5 shrink-0 transition-colors" />
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>

      </div>
    </>
  );
}
