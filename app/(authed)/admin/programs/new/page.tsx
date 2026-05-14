import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
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
      <div className="max-w-2xl p-4 sm:p-6 lg:p-8">
        <Link href="/admin/programs" className="text-text-muted hover:text-text mb-6 inline-flex items-center gap-1 text-sm">
          <ChevronLeft className="h-4 w-4" />Back to programmes
        </Link>
        <ProgramForm action={createProgramAction} />
      </div>
    </>
  );
}
