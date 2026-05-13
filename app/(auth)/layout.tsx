import Link from 'next/link';

/**
 * Minimal centered layout for sign-in / sign-up / forgot-password pages.
 * Deliberately omits the main app shell (no sidebar / topbar).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-background text-text flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link
        href="/"
        className="text-accent font-heading mb-10 text-2xl font-semibold tracking-tight"
      >
        Elevate Coaching
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
