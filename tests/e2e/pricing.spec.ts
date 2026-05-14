import { test, expect } from '@playwright/test';

test.describe('SP-3 /pricing smoke', () => {
  test('renders both plan cards with correct prices', async ({ page }) => {
    await page.goto('/pricing');

    // Both card headings visible
    await expect(page.getByText('Basic')).toBeVisible();
    await expect(page.getByText('Pro')).toBeVisible();

    // Prices
    await expect(page.getByText('£150')).toBeVisible();
    await expect(page.getByText('£300')).toBeVisible();

    // Logged-out CTA buttons (two "Get started" links)
    const getStartedLinks = page.getByRole('link', { name: 'Get started' });
    await expect(getStartedLinks).toHaveCount(2);
  });

  test('"Pricing" link appears in the landing nav', async ({ page }) => {
    await page.goto('/');
    const pricingLink = page.getByRole('link', { name: 'Pricing' });
    await expect(pricingLink).toBeVisible();
    await pricingLink.click();
    await expect(page).toHaveURL(/\/pricing/);
  });
});
