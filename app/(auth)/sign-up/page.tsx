import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { SignUpForm } from './sign-up-form';

export const metadata = {
  title: 'Sign up · Elevate Coaching',
};

export default function SignUpPage() {
  return (
    <Card className="bg-surface border-border">
      <CardHeader>
        <h1 className="font-heading text-base leading-snug font-medium text-text text-xl" data-slot="card-title">Create your account</h1>
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
