import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { Sidebar } from '@/components/layout/Sidebar';

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

  const hdrs = await headers();
  const currentPath = hdrs.get('x-pathname') || '';

  return (
    <div className="bg-background flex min-h-screen">
      <Sidebar currentPath={currentPath} />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
