/**
 * Onboarding form state. Lives in a plain module (not the "use server" file)
 * for the same Next.js 16 reason as sign-up/state.ts — server-action modules
 * may only export async functions. See app/(auth)/sign-up/state.ts for the
 * full rationale.
 */

export type OnboardingState = { status: 'idle'; error: null } | { status: 'error'; error: string };

export const onboardingInitialState: OnboardingState = {
  status: 'idle',
  error: null,
};
