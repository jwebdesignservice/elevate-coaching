import Link from 'next/link';
import { ChevronLeft, Sparkles } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { requireCoach } from '@/lib/auth';
import { ExerciseForm } from './exercise-form';
import { createExerciseAction } from './actions';

export const metadata = { title: 'New Exercise · Admin · Elevate Coaching' };

export default async function NewExercisePage() {
  const { profile } = await requireCoach();
  return (
    <>
      <TopBar title="New Exercise" subtitle="Add to the global library" userTier={profile.subscription_tier} userName={profile.name} />
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
        <Link href="/admin/exercises" className="text-text-muted hover:text-text inline-flex items-center gap-1 text-sm">
          <ChevronLeft className="h-4 w-4" />Back to library
        </Link>
        <section className="space-y-2">
          <p className="text-text-dim text-xs font-medium uppercase tracking-[0.18em]">
            <Sparkles className="mr-1.5 inline h-3 w-3" />
            New exercise
          </p>
          <h1 className="text-text text-3xl font-bold tracking-tight">Add an exercise.</h1>
          <p className="text-text-muted text-sm">Once created, you can reference this exercise from any programme session.</p>
        </section>
        <ExerciseForm action={createExerciseAction} />
      </div>
    </>
  );
}
