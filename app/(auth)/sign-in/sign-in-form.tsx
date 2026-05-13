'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signInAction, type SignInState } from './actions';

const initialState: SignInState = { error: null };

export function SignInForm() {
  const [state, formAction, isPending] = useActionState(signInAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email" className="text-text">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={isPending}
          className="bg-background border-border text-text h-10"
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="text-text">
            Password
          </Label>
          {/* TODO: implement /forgot-password route */}
          <Link
            href="/forgot-password"
            className="text-text-muted hover:text-accent text-xs underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={isPending}
          className="bg-background border-border text-text h-10"
        />
      </div>

      {state.error ? (
        <p
          role="alert"
          className="text-destructive border-destructive/40 bg-destructive/10 rounded-md border px-3 py-2 text-sm"
        >
          {state.error}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={isPending}
        className="bg-accent text-accent-foreground hover:bg-accent/90 h-10 w-full font-medium"
      >
        {isPending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
