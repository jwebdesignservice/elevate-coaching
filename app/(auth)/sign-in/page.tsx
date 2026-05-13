import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SignInForm } from './sign-in-form';

export const metadata = {
  title: 'Sign in · Elevate Coaching',
};

const ERROR_MESSAGES: Record<string, string> = {
  link_expired: 'Your confirmation link has expired. Please sign up again to receive a new one.',
  verification_failed: 'Email verification failed. Please try signing up again.',
  access_denied: 'Access denied. Please try signing in or contact your coach.',
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const notice = params.error ? (ERROR_MESSAGES[params.error] ?? null) : null;

  return (
    <Card className="bg-surface border-border">
      <CardHeader>
        <CardTitle className="text-text font-heading text-xl">Welcome back</CardTitle>
        <CardDescription className="text-text-muted">
          Sign in to your Elevate Coaching account.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SignInForm notice={notice} />
        <p className="text-text-muted text-center text-sm">
          New here?{' '}
          <Link href="/sign-up" className="text-accent underline-offset-4 hover:underline">
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
