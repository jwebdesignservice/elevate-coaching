import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
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
      <div className="max-w-2xl p-4 sm:p-6 lg:p-8">
        <Link href="/admin/exercises" className="text-text-muted hover:text-text mb-6 inline-flex items-center gap-1 text-sm">
          <ChevronLeft className="h-4 w-4" />Back to exercises
        </Link>
        <ExerciseForm action={createExerciseAction} />
      </div>
    </>
  );
}
