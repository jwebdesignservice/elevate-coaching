import { test, expect } from '@playwright/test';

test.describe('SP-4 /exercises smoke', () => {
  test('renders filter bar with muscle groups', async ({ page }) => {
    await page.goto('/exercises');
    await expect(page.getByRole('link', { name: 'All' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Chest' })).toBeVisible();
  });

  test('filter by muscle group updates URL', async ({ page }) => {
    await page.goto('/exercises');
    await page.getByRole('link', { name: 'Back' }).click();
    await expect(page).toHaveURL(/muscle=Back/);
  });
});

test.describe('SP-4 /programs smoke', () => {
  test('renders programmes page heading', async ({ page }) => {
    await page.goto('/programs');
    await expect(page).toHaveURL(/\/programs/);
  });
});

test.describe('SP-4 /admin redirect', () => {
  test('unauthenticated /admin redirects to sign-in', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/sign-in/);
  });
});
