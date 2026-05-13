// app/page.tsx — TEMPORARY: replaced fully in Task 38 (marketing landing page).
// Phase D adds CTA buttons so the auth flow is reachable from the root.
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <main className="bg-background flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <h1 className="text-accent font-heading text-4xl font-semibold tracking-tight">
        Elevate Coaching
      </h1>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          nativeButton={false}
          render={<Link href="/sign-in" />}
          variant="outline"
          className="border-border text-text hover:bg-surface-hover h-10 px-6"
        >
          Sign in
        </Button>
        <Button
          nativeButton={false}
          render={<Link href="/sign-up" />}
          className="bg-accent text-accent-foreground hover:bg-accent/90 h-10 px-6"
        >
          Sign up
        </Button>
      </div>
    </main>
  );
}
