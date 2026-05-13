import { headers } from 'next/headers';
import { requireUser } from '@/lib/auth';
import { Sidebar } from '@/components/layout/Sidebar';

export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  // Gate: redirects to /sign-in when unauthenticated. Result discarded — the
  // page itself re-fetches the profile when it needs it (deduped per request
  // by React's `cache` inside `getCurrentUser`/`requireUser`).
  await requireUser();

  const hdrs = await headers();
  const currentPath = hdrs.get('x-pathname') || '';

  return (
    <div className="bg-background flex min-h-screen">
      <Sidebar currentPath={currentPath} />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
