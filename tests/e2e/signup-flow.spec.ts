import { test, expect } from '@playwright/test';

/**
 * SP-1 end-to-end smoke for the public/auth surface.
 *
 * Adapted from the original Clerk-flavored plan. Auth is now Supabase
 * (cookie-based session via @supabase/ssr) and the sign-up form is a
 * custom shadcn/Base UI form — not an iframed Clerk widget — so we
 * assert on our own DOM rather than Clerk-specific selectors.
 *
 * Live verification of the protected-redirect path was already proven
 * by a curl smoke test in Phase F; this re-asserts it through the
 * browser. The two render tests guard against future regressions in
 * the landing page (Task 34) and sign-up surface.
 */

test.describe('SP-1 signup flow smoke', () => {
  test('landing page renders the hero + Get started CTA', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: /train like you have a 1-1 coach/i }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /get started/i })).toBeVisible();
  });

  test('protected routes redirect unauthenticated visitors to /sign-in', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test('sign-up page renders the custom form (email + password + submit)', async ({ page }) => {
    await page.goto('/sign-up');
    await expect(page.getByRole('heading', { name: /create your account/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
  });
});
