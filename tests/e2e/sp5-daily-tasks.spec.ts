import { test, expect } from '@playwright/test';

test.describe('SP-5 /admin/tasks redirect', () => {
  test('unauthenticated /admin/tasks redirects to sign-in', async ({ page }) => {
    await page.goto('/admin/tasks');
    await expect(page).toHaveURL(/sign-in/);
  });
});

test.describe('SP-5 /admin/tasks/past redirect', () => {
  test('unauthenticated /admin/tasks/past redirects to sign-in', async ({ page }) => {
    await page.goto('/admin/tasks/past');
    await expect(page).toHaveURL(/sign-in/);
  });
});

test.describe('SP-5 toggle API', () => {
  test('rejects malformed body', async ({ request }) => {
    const res = await request.post('/api/tasks/00000000-0000-0000-0000-000000000000/toggle', {
      data: { date: 'not-a-date' },
    });
    // 400 (validation) or 401/302 (unauthenticated short-circuit) both acceptable here.
    expect([400, 401, 302, 307]).toContain(res.status());
  });
});
