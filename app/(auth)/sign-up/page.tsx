import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SignUpForm } from './sign-up-form';

export const metadata = {
  title: 'Sign up · Elevate Coaching',
};

export default function SignUpPage() {
  return (
    <Card className="bg-surface border-border">
      <CardHeader>
        <CardTitle className="text-text font-heading text-xl">Create your account</CardTitle>
        <CardDescription className="text-text-muted">
          Start training with Elevate Coaching.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SignUpForm />
        <p className="text-text-muted text-center text-sm">
          Already have an account?{' '}
          <Link href="/sign-in" className="text-accent underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
