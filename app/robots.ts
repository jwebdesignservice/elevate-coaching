import type { MetadataRoute } from 'next';

/**
 * Robots policy.
 *
 * Public surface (landing, sign-in, sign-up) is open to crawlers — they
 * shouldn't see the rest because middleware redirects unauthed visitors
 * to `/sign-in`, but we add `disallow` rules anyway to keep crawl
 * budget pointed at the marketing pages.
 *
 * The host is fixed to the production alias; preview deploys serve a
 * non-canonical hostname and inherit `disallow` only via NEXT_PUBLIC_URL
 * if we wire it. For SP-1 we hard-code the prod host.
 */
const SITE_URL = 'https://elevate-coaching-two.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/sign-in', '/sign-up', '/forgot-password'],
        disallow: ['/dashboard', '/settings', '/auth/', '/api/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
