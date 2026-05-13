/**
 * Settings server-action state. Lives outside the "use server" file (Next.js
 * 16 disallows non-async exports from server modules). See
 * app/(auth)/sign-up/state.ts for the full rationale.
 */

export type RequestCategoryChangeState =
  | { status: 'idle'; error: null; message: null }
  | { status: 'error'; error: string; message: null }
  | { status: 'success'; error: null; message: string };

export const requestCategoryChangeInitialState: RequestCategoryChangeState = {
  status: 'idle',
  error: null,
  message: null,
};
