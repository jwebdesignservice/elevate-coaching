import Stripe from 'stripe';
import { env } from '@/lib/env';
import type { PlanTier } from '@/lib/plans';

// Singleton — instantiated once per cold start on the server.
export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-04-22.dahlia',
  typescript: true,
});

export const PRICE_IDS: Record<'basic' | 'pro', string> = {
  basic: env.STRIPE_BASIC_PRICE_ID,
  pro:   env.STRIPE_PRO_PRICE_ID,
};

const PRICE_TO_TIER: Record<string, PlanTier> = {
  [env.STRIPE_BASIC_PRICE_ID]: 'basic',
  [env.STRIPE_PRO_PRICE_ID]:   'pro',
};

/**
 * Maps a Stripe price ID back to an internal PlanTier.
 * Returns 'free' for unknown price IDs — safe default, never accidentally grants access.
 */
export function tierFromPriceId(priceId: string): PlanTier {
  return PRICE_TO_TIER[priceId] ?? 'free';
}
