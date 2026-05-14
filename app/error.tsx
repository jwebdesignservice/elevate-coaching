'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RotateCw } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { Logo } from '@/components/branded/Logo';
import { Button } from '@/components/ui/button';

/**
 * Segment-level error boundary. Catches unhandled errors thrown by any
 * Server Component, Client Component, or render in the app/ tree (except
 * the root layout — those go to global-error.tsx).
 *
 * Reports to Sentry on mount, then offers the user a manual retry and
 * a way home.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="bg-background text-text flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-12 text-center">
      <Logo variant="full" />
      <div className="max-w-md">
        <div className="text-destructive mb-4 text-xs font-semibold tracking-[0.3em] uppercase">
          Something went wrong
        </div>
        <h1 className="text-text mb-4 text-4xl leading-tight font-bold tracking-tight">
          We hit an unexpected error.
        </h1>
        <p className="text-text-muted mb-8 text-sm leading-relaxed">
          Our team has been notified. You can try again, or head back home and pick up where you
          left off.
          {error.digest && (
            <>
              <br />
              <span className="text-text-dim mt-3 inline-block font-mono text-xs">
                Reference: {error.digest}
              </span>
            </>
          )}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            type="button"
            onClick={() => reset()}
            className="bg-accent text-accent-fg hover:bg-accent/90 hover:shadow-lg hover:shadow-accent/40"
          >
            <RotateCw className="h-4 w-4" />
            Try again
          </Button>
          <Button
            nativeButton={false}
            render={<Link href="/" />}
            variant="outline"
            className="border-border text-text"
          >
            Go home
          </Button>
        </div>
      </div>
    </main>
  );
}
