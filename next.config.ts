import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  silent: true,
  // Sentry CLI options — real values land when user creates Sentry account
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Bundle protection options (sensible defaults)
  widenClientFileUpload: true,
  sourcemaps: {
    // Delete sourcemaps after upload so they aren't publicly accessible
    deleteSourcemapsAfterUpload: true,
  },
  disableLogger: true,
});
