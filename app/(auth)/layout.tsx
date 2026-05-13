import Link from 'next/link';
import { Logo } from '@/components/branded/Logo';

/**
 * Minimal centered layout for sign-in / sign-up / forgot-password pages.
 * Deliberately omits the main app shell (no sidebar / topbar).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-background text-text flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/" aria-label="Elevate Coaching home" className="mb-10">
        <Logo variant="full" />
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
