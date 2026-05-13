import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SignInForm } from './sign-in-form';

export const metadata = {
  title: 'Sign in · Elevate Coaching',
};

export default function SignInPage() {
  return (
    <Card className="bg-surface border-border">
      <CardHeader>
        <CardTitle className="text-text font-heading text-xl">Welcome back</CardTitle>
        <CardDescription className="text-text-muted">
          Sign in to your Elevate Coaching account.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SignInForm />
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
