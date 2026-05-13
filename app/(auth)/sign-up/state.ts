/**
 * Sign-up form state — extracted out of ./actions.ts so it lives in a plain
 * module rather than a "use server" module. Next.js 16 enforces that
 * `'use server'` files may only export async functions; exporting a plain
 * object or non-erased value from such a file throws at runtime:
 *
 *   Error: A "use server" file can only export async functions, found object.
 *
 * The type alone would survive (TypeScript erases types at compile time) but
 * the initial-state object needs a real module to live in. Keeping the type
 * here too keeps the two pieces co-located.
 */

export type SignUpState =
  | { status: 'idle'; error: null; email: null }
  | { status: 'error'; error: string; email: null }
  | { status: 'success'; error: null; email: string };

export const signUpInitialState: SignUpState = {
  status: 'idle',
  error: null,
  email: null,
};
