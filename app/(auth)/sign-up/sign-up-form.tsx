'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signUpAction } from './actions';
import { signUpInitialState, type SignUpState } from './state';

export function SignUpForm() {
  const [state, formAction, isPending] = useActionState<SignUpState, FormData>(
    signUpAction,
    signUpInitialState,
  );

  if (state.status === 'success') {
    return (
      <div className="flex flex-col gap-3">
        <p
          role="status"
          className="text-success border-success/30 bg-success/10 rounded-md border px-4 py-3 text-sm"
        >
          Check your email at <span className="font-medium">{state.email}</span> to confirm your
          account. Once confirmed, sign in to access your dashboard.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name" className="text-text">
          Name
        </Label>
        <Input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          disabled={isPending}
          className="bg-background border-border text-text h-10"
        />
      </div>

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
        <Label htmlFor="password" className="text-text">
          Password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          disabled={isPending}
          className="bg-background border-border text-text h-10"
        />
        <p className="text-text-dim text-xs">At least 8 characters.</p>
      </div>

      {state.status === 'error' && state.error ? (
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
        className="bg-accent text-accent-fg hover:bg-accent/80 hover:text-white hover:border-accent h-10 w-full font-medium"
      >
        {isPending ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  );
}
