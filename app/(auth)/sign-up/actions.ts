'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const signUpSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(120, 'Name is too long.'),
  email: z.string().email('Please enter a valid email address.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(128, 'Password is too long.'),
});

export type SignUpState =
  | { status: 'idle'; error: null; email: null }
  | { status: 'error'; error: string; email: null }
  | { status: 'success'; error: null; email: string };

export const signUpInitialState: SignUpState = {
  status: 'idle',
  error: null,
  email: null,
};

export async function signUpAction(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const parsed = signUpSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      status: 'error',
      error: firstIssue?.message ?? 'Invalid input.',
      email: null,
    };
  }

  // Build an absolute URL for emailRedirectTo. Supabase rejects relative paths.
  const headerList = await headers();
  const host = headerList.get('host') ?? 'localhost:3000';
  const proto = headerList.get('x-forwarded-proto') ?? 'http';
  const emailRedirectTo = `${proto}://${host}/auth/confirm`;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { name: parsed.data.name },
      emailRedirectTo,
    },
  });

  if (error) {
    return { status: 'error', error: error.message, email: null };
  }

  // Email confirmation is on. No session yet — caller renders the
  // "check your email" view rather than redirecting to /dashboard.
  return { status: 'success', error: null, email: parsed.data.email };
}
