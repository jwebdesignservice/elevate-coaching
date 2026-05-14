import Link from 'next/link';
import { ChevronLeft, Sparkles } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { requireCoach } from '@/lib/auth';
import { ProgramForm } from './program-form';
import { createProgramAction } from './actions';

export const metadata = { title: 'New Programme · Admin · Elevate Coaching' };

export default async function NewProgramPage() {
  const { profile } = await requireCoach();
  return (
    <>
      <TopBar title="New Programme" subtitle="Create metadata — add weeks and sessions next" userTier={profile.subscription_tier} userName={profile.name} />
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
        <Link href="/admin/programs" className="text-text-muted hover:text-text inline-flex items-center gap-1 text-sm">
          <ChevronLeft className="h-4 w-4" />Back to programmes
        </Link>
        <section className="space-y-2">
          <p className="text-text-dim text-xs font-medium uppercase tracking-[0.18em]">
            <Sparkles className="mr-1.5 inline h-3 w-3" />
            New programme
          </p>
          <h1 className="text-text text-3xl font-bold tracking-tight">Author a training journey.</h1>
          <p className="text-text-muted text-sm">Set the basics now. Add weeks, sessions and exercises on the next page.</p>
        </section>
        <ProgramForm action={createProgramAction} />
      </div>
    </>
  );
}
