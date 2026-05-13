import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — used by the e2e smoke suite in `tests/e2e/`.
 *
 * Vitest unit tests live under `tests/lib/` and are excluded from this
 * suite via `testDir`. Vitest is configured (in `vitest.config.ts`) to
 * ignore `tests/e2e/**` in turn, so the two runners do not collide.
 *
 * Local dev: `npm run test:e2e` will reuse an already-running
 * `npm run dev` on :3000, or spawn one if none is up.
 * CI: webServer ensures the build is started before tests run.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
