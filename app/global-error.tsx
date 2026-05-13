'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

/**
 * Root-layout error boundary. Catches errors thrown by the root layout
 * itself — at this point we can't rely on any of the brand tokens or
 * the Inter font being available, so the markup is inlined with system
 * fonts and a flat dark surface.
 *
 * Almost no one ever sees this — but when they do, things have gone
 * very wrong and we want at least a working "reload" button.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          background: '#0a0b0b',
          color: '#ffffff',
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '3rem 1.5rem',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontSize: '2rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            margin: 0,
            marginBottom: '0.75rem',
          }}
        >
          Something went wrong.
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.95rem', maxWidth: 420, lineHeight: 1.6 }}>
          A fatal error prevented Elevate Coaching from loading. Try refreshing the page; if it
          keeps happening, contact your coach.
        </p>
        {error.digest && (
          <p
            style={{
              color: '#6b7280',
              fontSize: '0.75rem',
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              marginTop: '1rem',
            }}
          >
            Reference: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: '2rem',
            background: '#2de3a8',
            color: '#003d2b',
            border: 0,
            padding: '0.6rem 1.25rem',
            fontWeight: 600,
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
