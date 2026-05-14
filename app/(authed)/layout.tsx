import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import type { PlanTier } from '@/lib/plans';

export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  // Gate 1: requires a signed-in user with a profile row. Redirects to
  // /sign-in if either is missing. Result is consumed here so the gate below
  // can read profile.category.
  const { profile } = await requireUser();

  // Gate 2: every authed page assumes the user has picked a training
  // category. New sign-ups land here without one (handle_new_user trigger
  // sets category = NULL); bounce them to /onboarding until they pick.
  if (!profile.category) {
    redirect('/onboarding');
  }

  const tier = (profile.subscription_tier as PlanTier) ?? 'free';
  const role = (profile.role === 'coach' ? 'coach' : 'user') as 'user' | 'coach';

  return (
    <div className="bg-background flex h-screen overflow-hidden">
      <Sidebar tier={tier} role={role} />
      <MobileNav tier={tier} role={role} />
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">{children}</main>
    </div>
  );
}
