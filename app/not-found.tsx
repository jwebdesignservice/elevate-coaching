import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/branded/Logo';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Page not found · Elevate Coaching',
};

export default function NotFound() {
  return (
    <main className="bg-background text-text flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-12 text-center">
      <Logo variant="full" />
      <div className="max-w-md">
        <div className="text-accent mb-4 text-xs font-semibold tracking-[0.3em] uppercase">
          Error 404
        </div>
        <h1 className="text-text mb-4 text-5xl leading-tight font-bold tracking-tight">
          Page not found.
        </h1>
        <p className="text-text-muted mb-8 text-base leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist, or has been moved. Let&apos;s get you
          back on track.
        </p>
        <Button
          nativeButton={false}
          render={<Link href="/" />}
          className="bg-accent text-accent-fg hover:bg-accent/90 hover:shadow-lg hover:shadow-accent/40"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Button>
      </div>
    </main>
  );
}
