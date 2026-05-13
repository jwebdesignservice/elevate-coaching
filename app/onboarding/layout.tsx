import { Logo } from '@/components/branded/Logo';

/**
 * Onboarding layout — centered single-column flow.
 *
 * Deliberately omits the authed shell (no Sidebar, no TopBar). The user has a
 * session and a profile by the time they reach /onboarding but they are
 * mid-flow, not yet inside the app proper. The logo at the top establishes
 * brand without giving them a nav out of the flow.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-background text-text flex min-h-screen flex-col items-center px-4 py-12">
      <div className="mb-10">
        <Logo variant="full" />
      </div>
      <div className="w-full max-w-3xl">{children}</div>
    </main>
  );
}
