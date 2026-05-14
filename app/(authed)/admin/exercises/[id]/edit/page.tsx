import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Pencil } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { requireCoach } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { ExerciseForm } from '../../new/exercise-form';
import { updateExerciseAction } from './actions';
import { exerciseImage } from '@/lib/exercise-images';

export const metadata = { title: 'Edit Exercise · Admin · Elevate Coaching' };

export default async function EditExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const { profile } = await requireCoach();
  const { id } = await params;

  const adminClient = createSupabaseAdminClient();
  const { data: raw } = await adminClient.from('exercises').select('*').eq('id', id).single();
  if (!raw) notFound();

  const exercise = raw as { id: string; title: string; description: string | null; video_url: string | null; muscle_groups: string[]; tags: string[] };
  const boundAction = updateExerciseAction.bind(null, id);
  const previewImg = exerciseImage(exercise.title);

  return (
    <>
      <TopBar title="Edit Exercise" subtitle={exercise.title} userTier={profile.subscription_tier} userName={profile.name} />
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
        <Link href="/admin/exercises" className="text-text-muted hover:text-text inline-flex items-center gap-1 text-sm">
          <ChevronLeft className="h-4 w-4" />Back to library
        </Link>

        {/* Hero with current image preview */}
        <section className="bg-surface border-border relative overflow-hidden rounded-md border">
          <div className="relative h-40 sm:h-48">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewImg} alt={exercise.title} className="absolute inset-0 block h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface via-surface/60 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
              <p className="text-accent text-[10px] font-bold uppercase tracking-[0.18em]">
                <Pencil className="mr-1.5 inline h-3 w-3" />
                Editing
              </p>
              <h1 className="text-text mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{exercise.title}</h1>
              <p className="text-text-muted mt-0.5 text-xs capitalize">
                {exercise.muscle_groups.slice(0, 4).map((m) => m.replace(/-/g, ' ')).join(' · ') || 'No muscle groups set'}
              </p>
            </div>
          </div>
        </section>

        <ExerciseForm
          action={boundAction}
          defaultValues={{
            title: exercise.title,
            description: exercise.description ?? undefined,
            video_url: exercise.video_url ?? undefined,
            muscle_groups: exercise.muscle_groups,
            tags: exercise.tags.join(', '),
          }}
          submitLabel="Save changes"
        />
      </div>
    </>
  );
}
