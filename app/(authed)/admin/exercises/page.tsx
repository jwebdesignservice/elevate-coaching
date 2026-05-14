import Link from 'next/link';
import { ChevronLeft, Plus, Pencil, Search, Dumbbell, Layers, Wrench, Sparkles } from 'lucide-react';
import { requireCoach } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { exerciseImage } from '@/lib/exercise-images';

export const metadata = { title: 'Exercises · Admin · Elevate Coaching' };

type ExerciseRow = { id: string; title: string; muscle_groups: string[]; tags: string[] };

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

export default async function AdminExercisesPage() {
  const { profile } = await requireCoach();
  const supabase = await createSupabaseServerClient();

  const { data: raw } = await supabase.from('exercises').select('id, title, muscle_groups, tags').order('title');
  const exercises = (raw ?? []) as ExerciseRow[];

  // Quick aggregations for the stats row
  const allMuscles = new Set<string>();
  let compoundCount = 0;
  let videoMissingCount = 0;
  for (const ex of exercises) {
    for (const m of ex.muscle_groups) allMuscles.add(m);
    if (ex.tags.includes('compound')) compoundCount++;
    // Note: video_url not selected — videoMissingCount stays 0 (placeholder for future)
  }
  void videoMissingCount;

  return (
    <>
      <TopBar
        title="Exercise Library"
        subtitle={`${exercises.length} exercise${exercises.length !== 1 ? 's' : ''} in library`}
        userTier={profile.subscription_tier}
        userName={profile.name}
      />
      <div className="space-y-8 p-4 sm:p-6 lg:p-8">
        <Link href="/admin" className="text-text-muted hover:text-text inline-flex items-center gap-1 text-sm">
          <ChevronLeft className="h-4 w-4" />Coach console
        </Link>

        {/* Hero */}
        <section className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-2">
            <p className="text-text-dim text-xs font-medium uppercase tracking-[0.18em]">
              <Sparkles className="mr-1.5 inline h-3 w-3" />
              Library
            </p>
            <h1 className="text-text text-3xl font-bold tracking-tight sm:text-4xl">
              Exercise catalogue.
            </h1>
            <p className="text-text-muted max-w-xl text-sm">
              Every movement in your platform — descriptions, tags, muscle group routing.
            </p>
          </div>
          <Link
            href="/admin/exercises/new"
            className={buttonVariants({ className: 'bg-accent text-accent-fg hover:bg-accent/80 hover:text-white hover:border-accent' })}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New exercise
          </Link>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile icon={Dumbbell} value={exercises.length} label="Total" />
          <StatTile icon={Layers}   value={compoundCount}    label="Compound" />
          <StatTile icon={Wrench}   value={allMuscles.size}  label="Muscle groups" />
          <StatTile icon={Search}   value={exercises.length - compoundCount} label="Accessory" />
        </section>

        {/* Grid */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-text text-lg font-semibold">All exercises</h2>
            <span className="text-text-dim text-xs">Click any card to edit</span>
          </div>

          {exercises.length === 0 ? (
            <Card className="bg-surface border-border p-12 text-center">
              <Dumbbell className="text-text-dim mx-auto h-8 w-8" />
              <p className="text-text-muted mt-3 text-sm">No exercises yet — create the first one.</p>
              <Link
                href="/admin/exercises/new"
                className={buttonVariants({ className: 'bg-accent text-accent-fg hover:bg-accent/80 hover:text-white hover:border-accent mt-4 inline-flex' })}
              >
                <Plus className="mr-1 h-4 w-4" />Create exercise
              </Link>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {exercises.map((ex) => {
                const img = exerciseImage(ex.title);
                const type = exerciseType(ex.tags);
                const equipment = exerciseEquipment(ex.tags);
                const primary = ex.muscle_groups[0];
                return (
                  <Link key={ex.id} href={`/admin/exercises/${ex.id}/edit`}>
                    <Card className="bg-surface border-border hover:border-accent/40 group relative flex h-full flex-col overflow-hidden p-0 transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/40">
                      <div className="relative h-36 overflow-hidden transform-gpu">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img}
                          alt={ex.title}
                          className="absolute inset-0 block h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface via-surface/10 to-transparent" />
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
                      <div className="flex flex-1 flex-col gap-2 p-4">
                        <h3 className="text-text text-base font-semibold leading-snug transition-colors group-hover:text-accent/90">
                          {ex.title}
                        </h3>
                        <p className="text-text-dim line-clamp-1 text-[11px] capitalize">
                          {ex.muscle_groups.slice(0, 4).map((m) => m.replace(/-/g, ' ')).join(' · ') || 'No muscle groups'}
                        </p>
                        <div className="mt-auto flex items-center justify-between pt-2">
                          <span className="text-text-dim text-[10px]">
                            {ex.tags.length} tag{ex.tags.length === 1 ? '' : 's'}
                          </span>
                          <span className="text-accent group-hover:text-accent/80 flex items-center gap-1 text-xs font-semibold">
                            <Pencil className="h-3 w-3" />
                            Edit
                          </span>
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function StatTile({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: number | string; label: string }) {
  return (
    <div className="bg-surface border-border flex flex-col gap-1 rounded-md border p-3">
      <Icon className="text-accent h-4 w-4" />
      <span className="text-text text-2xl font-bold leading-none">{value}</span>
      <span className="text-text-dim text-[10px] font-medium uppercase tracking-wider">{label}</span>
    </div>
  );
}
