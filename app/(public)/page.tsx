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

      <section className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-2xl text-center">
          <div className="text-accent mb-4 text-xs tracking-widest uppercase">
            Premium Training Platform
          </div>
          <h1 className="text-text mb-6 text-5xl leading-tight font-semibold">
            Train like you have a 1-1 coach,
            <br />
            <span className="text-accent">without the price tag.</span>
          </h1>
          <p className="text-text-muted mb-8 text-lg leading-relaxed">
            Personalized programs, exercise tutorials, daily accountability and nutrition guidance —
            built around your goals, delivered by your coach.
          </p>
          <div className="flex justify-center gap-3">
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
