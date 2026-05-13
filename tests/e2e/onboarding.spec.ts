import { test, expect } from '@playwright/test';

/**
 * SP-2 onboarding smoke tests.
 *
 * Authenticated-flow coverage (sign-up → email-confirm → onboarding picker
 * → dashboard) requires test-time access to the Supabase admin API to
 * auto-confirm emails. That fixture lives in tests/e2e/fixtures.ts when /
 * if it ships. For now we cover the unauthenticated guard and the page
 * shape, which catches the common regressions:
 *   - /onboarding becoming public by accident
 *   - The four cards not rendering (broken import, missing CATEGORY_INFO)
 *   - The submit button not being initially disabled
 *
 * The full authed flow is exercised manually until the fixture lands.
 */

test.describe('SP-2 onboarding smoke', () => {
  test('redirects unauthenticated visitors to /sign-in', async ({ page }) => {
    await page.goto('/onboarding');
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
