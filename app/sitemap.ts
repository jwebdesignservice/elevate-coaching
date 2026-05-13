import type { MetadataRoute } from 'next';

const SITE_URL = 'https://elevate-coaching-two.vercel.app';

/**
 * Sitemap covers the public-crawlable surface only. Authed routes
 * (/dashboard, /settings) are deliberately omitted — they're behind a
 * redirect and shouldn't appear in search results.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/sign-up`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/sign-in`, lastModified, changeFrequency: 'monthly', priority: 0.6 },
  ];
}
