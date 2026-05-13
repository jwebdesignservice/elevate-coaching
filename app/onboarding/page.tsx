import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { OnboardingForm } from './onboarding-form';

export const metadata = {
  title: 'Pick your training category · Elevate Coaching',
};

/**
 * Onboarding page.
 *
 * Behaviour:
 *   - No session → redirect to /sign-in.
 *   - Has session + category already set → redirect to /dashboard. Prevents
 *     a re-onboarding loop if the user manually navigates back here.
 *   - Has session + category NULL → render the picker.
 *
 * The corresponding gate in app/(authed)/layout.tsx handles the opposite
 * direction (authed user hits /dashboard without a category → bounced here).
 */
export default async function OnboardingPage() {
  const current = await getCurrentUser();
  if (!current) redirect('/sign-in');
  if (current.profile.category) redirect('/dashboard');

  const firstName = current.profile.name?.split(/\s+/)[0]?.trim() || 'there';

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3 text-center">
        <p className="text-accent text-[11px] font-semibold tracking-[0.25em] uppercase">
          Welcome, {firstName}
        </p>
        <h1 className="text-text text-3xl font-bold tracking-tight md:text-4xl">
          Pick your training category
        </h1>
        <p className="text-text-muted mx-auto max-w-xl text-sm leading-relaxed">
          Choose the lane that fits where you are now. Your coach builds
          programmes, tutorials, and weekly tasks for each category — picking
          accurately means everything that follows is built for you.
        </p>
      </header>

      <OnboardingForm />
    </div>
  );
}
