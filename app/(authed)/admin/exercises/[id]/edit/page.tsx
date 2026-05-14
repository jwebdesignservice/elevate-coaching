import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { requireCoach } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { ExerciseForm } from '../../new/exercise-form';
import { updateExerciseAction } from './actions';

export const metadata = { title: 'Edit Exercise · Admin · Elevate Coaching' };

export default async function EditExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const { profile } = await requireCoach();
  const { id } = await params;

  const adminClient = createSupabaseAdminClient();
  const { data: raw } = await adminClient.from('exercises').select('*').eq('id', id).single();
  if (!raw) notFound();

  const exercise = raw as { id: string; title: string; description: string | null; video_url: string | null; muscle_groups: string[]; tags: string[] };
  const boundAction = updateExerciseAction.bind(null, id);

  return (
    <>
      <TopBar title="Edit Exercise" subtitle={exercise.title} userTier={profile.subscription_tier} userName={profile.name} />
      <div className="max-w-2xl p-4 sm:p-6 lg:p-8">
        <Link href="/admin/exercises" className="text-text-muted hover:text-text mb-6 inline-flex items-center gap-1 text-sm">
          <ChevronLeft className="h-4 w-4" />Back to exercises
        </Link>
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
