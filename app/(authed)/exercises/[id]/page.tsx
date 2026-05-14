import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ChevronLeft,
  Dumbbell,
  Video,
  Target,
  Zap,
  Layers,
  Info,
  ExternalLink,
  ArrowRight,
  Wrench,
} from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import { exerciseImage } from '@/lib/exercise-images';
import type { MaxLifts } from '@/lib/lifts';

type ExerciseRow = {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  muscle_groups: string[];
  tags: string[];
};
type RelatedRow = { id: string; title: string; muscle_groups: string[]; tags: string[] };

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

function exercisePattern(tags: string[]): string | null {
  if (tags.includes('push')) return 'Push';
  if (tags.includes('pull')) return 'Pull';
  if (tags.includes('unilateral')) return 'Unilateral';
  if (tags.includes('posterior-chain')) return 'Hinge';
  return null;
}

export default async function ExerciseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: raw } = await supabase
    .from('exercises')
    .select('id, title, description, video_url, muscle_groups, tags')
    .eq('id', id)
    .single();
  if (!raw) notFound();

  const ex = raw as ExerciseRow;
  const img = exerciseImage(ex.title);

  // Fetch related exercises that share at least one muscle group
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const relatedRes = ex.muscle_groups.length > 0
    ? await (sb.from('exercises')
        .select('id, title, muscle_groups, tags')
        .overlaps('muscle_groups', ex.muscle_groups)
        .neq('id', id)
        .limit(4) as Promise<{ data: RelatedRow[] | null; error: unknown }>)
    : { data: null };
  const related = (relatedRes.data ?? []) as RelatedRow[];

  const lifts = profile as unknown as MaxLifts;
  const liftDisplay = [
    { label: 'Squat', value: lifts.max_lift_squat, key: 'squat' },
    { label: 'Bench', value: lifts.max_lift_bench, key: 'bench' },
    { label: 'Deadlift', value: lifts.max_lift_deadlift, key: 'deadlift' },
    { label: 'OHP', value: lifts.max_lift_ohp, key: 'ohp' },
  ];

  const type = exerciseType(ex.tags);
  const equipment = exerciseEquipment(ex.tags);
  const pattern = exercisePattern(ex.tags);

  return (
    <>
      <TopBar
        title={ex.title}
        subtitle={ex.muscle_groups.slice(0, 3).map((m) => m.replace(/-/g, ' ')).join(' · ') || 'Exercise'}
        userTier={profile.subscription_tier}
        userName={profile.name}
      />
      <div className="space-y-8 p-4 sm:p-6 lg:p-8">
        <Link href="/exercises" className="text-text-muted hover:text-text inline-flex items-center gap-1 text-sm">
          <ChevronLeft className="h-4 w-4" />Back to library
        </Link>

        {/* Cinematic hero */}
        <Card className="bg-surface border-border relative overflow-hidden p-0">
          <div className="relative h-64 sm:h-80">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt={ex.title} className="absolute inset-0 block h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface via-surface/70 to-surface/20" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2">
                {type && (
                  <span className="bg-black/60 text-white backdrop-blur-sm rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                    {type}
                  </span>
                )}
                {equipment && (
                  <span className="bg-black/60 text-white backdrop-blur-sm rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                    {equipment}
                  </span>
                )}
                {pattern && (
                  <span className="bg-accent/20 text-accent rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                    {pattern}
                  </span>
                )}
              </div>
              <h1 className="text-text mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                {ex.title}
              </h1>
              {ex.muscle_groups.length > 0 && (
                <p className="text-text-muted mt-1 text-sm capitalize">
                  Targets {ex.muscle_groups.slice(0, 4).map((m) => m.replace(/-/g, ' ')).join(' · ')}
                  {ex.muscle_groups.length > 4 && ` +${ex.muscle_groups.length - 4}`}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile icon={Layers} value={type ?? '—'} label="Type" />
          <StatTile icon={Wrench} value={equipment ?? '—'} label="Equipment" />
          <StatTile icon={Target} value={ex.muscle_groups.length || '—'} label="Muscles" />
          <StatTile icon={Zap} value={pattern ?? '—'} label="Pattern" />
        </div>

        {/* Content grid */}
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          {/* Left column: how to perform + video */}
          <div className="space-y-4">
            {ex.description && (
              <Card className="bg-surface border-border p-5 sm:p-6">
                <div className="mb-3 flex items-center gap-2">
                  <Info className="text-accent h-4 w-4" />
                  <h3 className="text-text font-semibold">How to perform</h3>
                </div>
                <p className="text-text-muted text-sm leading-relaxed">{ex.description}</p>
              </Card>
            )}

            <Card className="bg-surface border-border p-5 sm:p-6">
              <div className="mb-3 flex items-center gap-2">
                <Video className="text-accent h-4 w-4" />
                <h3 className="text-text font-semibold">Video tutorial</h3>
              </div>
              {ex.video_url ? (
                <a
                  href={ex.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-muted/40 hover:bg-muted/60 group flex items-center justify-between rounded-md border border-border px-4 py-3 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-accent/15 text-accent flex h-9 w-9 items-center justify-center rounded-md">
                      <Video className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-text text-sm font-semibold">Watch walkthrough</p>
                      <p className="text-text-dim text-xs">Opens in a new tab</p>
                    </div>
                  </div>
                  <ExternalLink className="text-text-dim group-hover:text-accent h-4 w-4 transition-colors" />
                </a>
              ) : (
                <p className="text-text-dim text-xs italic">Video tutorial — coming soon.</p>
              )}
            </Card>

            {/* Tags */}
            {ex.tags.length > 0 && (
              <Card className="bg-surface border-border p-5 sm:p-6">
                <p className="text-text-dim mb-3 text-[10px] font-bold uppercase tracking-wider">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {ex.tags.map((tag) => (
                    <span key={tag} className="bg-muted text-text-muted rounded-md px-2 py-1 text-xs capitalize">
                      {tag.replace(/-/g, ' ')}
                    </span>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Right column: muscles + 1RM */}
          <div className="space-y-4">
            {ex.muscle_groups.length > 0 && (
              <Card className="bg-surface border-border p-5 sm:p-6">
                <div className="mb-3 flex items-center gap-2">
                  <Target className="text-accent h-4 w-4" />
                  <h3 className="text-text font-semibold">Muscles worked</h3>
                </div>
                <div className="space-y-2">
                  {ex.muscle_groups.map((mg, i) => (
                    <div key={mg} className="bg-muted/40 flex items-center gap-3 rounded-md px-3 py-2">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${i === 0 ? 'bg-accent text-accent-fg' : 'bg-muted text-text-dim'}`}>
                        {i === 0 ? '★' : i + 1}
                      </span>
                      <span className="text-text text-sm font-medium capitalize">{mg.replace(/-/g, ' ')}</span>
                      {i === 0 && (
                        <span className="text-accent ml-auto text-[10px] font-bold uppercase tracking-wider">Primary</span>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card className="bg-surface border-border p-5 sm:p-6">
              <div className="mb-3 flex items-center gap-2">
                <Dumbbell className="text-accent h-4 w-4" />
                <h3 className="text-text font-semibold">Your 1RM reference</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {liftDisplay.map(({ label, value }) => (
                  <div key={label} className="bg-muted/40 border-border/60 rounded-md border p-3">
                    <p className="text-text-dim text-[10px] font-bold uppercase tracking-wider">{label}</p>
                    <p className={`mt-0.5 text-xl font-bold ${value != null ? 'text-text' : 'text-text-dim'}`}>
                      {value != null ? `${value}kg` : '—'}
                    </p>
                  </div>
                ))}
              </div>
              <Link href="/settings" className="text-accent hover:text-accent/80 mt-3 inline-flex items-center gap-1 text-xs font-medium transition-colors">
                Update max lifts
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Card>
          </div>
        </div>

        {/* Related exercises */}
        {related.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-text text-lg font-semibold">Similar exercises</h2>
              <span className="text-text-dim text-xs">
                {related.length} sharing {ex.muscle_groups[0]?.replace(/-/g, ' ') ?? 'muscle group'}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((r) => {
                const rimg = exerciseImage(r.title);
                return (
                  <Link key={r.id} href={`/exercises/${r.id}`}>
                    <Card className="bg-surface border-border hover:border-accent/40 group overflow-hidden p-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30">
                      <div className="relative h-28 overflow-hidden transform-gpu">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={rimg} alt={r.title} className="absolute inset-0 block h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface/80 to-transparent" />
                      </div>
                      <div className="p-3">
                        <h3 className="text-text line-clamp-1 text-sm font-semibold transition-colors group-hover:text-accent/90">
                          {r.title}
                        </h3>
                        {r.muscle_groups[0] && (
                          <p className="text-text-dim mt-0.5 text-[11px] capitalize">
                            {r.muscle_groups[0].replace(/-/g, ' ')}
                          </p>
                        )}
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function StatTile({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: number | string; label: string }) {
  return (
    <div className="bg-surface border-border flex flex-col gap-1 rounded-md border p-3">
      <Icon className="text-accent h-4 w-4" />
      <span className={`text-base font-bold leading-tight ${value === '—' ? 'text-text-dim' : 'text-text'}`}>{value}</span>
      <span className="text-text-dim text-[10px] font-medium uppercase tracking-wider">{label}</span>
    </div>
  );
}
