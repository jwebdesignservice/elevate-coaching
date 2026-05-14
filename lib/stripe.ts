import Stripe from 'stripe';
import { env } from '@/lib/env';
import type { PlanTier } from '@/lib/plans';

// Lazy singleton — instantiated on first property access, not at module load.
// This matters because `next build` evaluates this module to collect page data
// for /api/stripe/* routes, and preview deployments may not have STRIPE_SECRET_KEY
// set. `new Stripe(undefined, …)` throws on construction, so we defer it.
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (_stripe) return _stripe;
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured for this environment.');
  }
  _stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-04-22.dahlia',
  });
  return _stripe;
}

// Proxy preserves the `stripe.xxx` ergonomics across the codebase while
// still deferring construction until first use.
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    return Reflect.get(getStripe(), prop, receiver);
  },
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
