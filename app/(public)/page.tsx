import Link from 'next/link';
import { Logo } from '@/components/branded/Logo';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Elevate Coaching — Train like you have a 1-1 coach',
  description:
    'Personalized training programs, exercise tutorials, daily accountability and nutrition guidance — built around your goals, delivered by your coach.',
};

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="border-border flex items-center justify-between border-b p-6">
        <Logo variant="full" />
        <nav className="flex items-center gap-4">
          <Link href="/sign-in" className="text-text-muted hover:text-text text-sm">
            Sign in
          </Link>
          <Button
            nativeButton={false}
            render={<Link href="/sign-up" />}
            className="bg-accent text-accent-fg hover:bg-accent/90"
          >
            Get started
          </Button>
        </nav>
      </header>

      <section className="relative flex flex-1 items-center justify-center overflow-hidden px-6">
        {/* subtle accent halo */}
        <div
          aria-hidden
          className="bg-accent/10 pointer-events-none absolute top-1/2 left-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        />
        <div className="relative max-w-3xl text-center">
          <div className="text-accent mb-5 text-xs font-semibold tracking-[0.3em] uppercase">
            Premium Training Platform
          </div>
          <h1 className="text-text mb-6 text-6xl leading-[1.05] font-bold tracking-tight">
            Train like you have a 1-1 coach,
            <br />
            <span className="text-accent">without the price tag.</span>
          </h1>
          <p className="text-text-muted mx-auto mb-10 max-w-xl text-lg leading-relaxed">
            Personalized programs, exercise tutorials, daily accountability and nutrition guidance —
            built around your goals, delivered by your coach.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              nativeButton={false}
              render={<Link href="/sign-up" />}
              size="lg"
              className="bg-accent text-accent-fg hover:bg-accent/90"
            >
              Start your transformation
            </Button>
            <Button
              nativeButton={false}
              render={<Link href="/sign-in" />}
              size="lg"
              variant="outline"
              className="border-border text-text"
            >
              I already have an account
            </Button>
          </div>
        </div>
      </section>

      <footer className="text-text-dim border-border border-t py-6 text-center text-xs">
        © 2026 Elevate Coaching
      </footer>
    </main>
  );
}
