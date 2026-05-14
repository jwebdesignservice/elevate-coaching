export const PLAN_TIERS = ['free', 'basic', 'pro'] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

const PLAN_RANK: Record<PlanTier, number> = { free: 0, basic: 1, pro: 2 };

/**
 * Returns true when the user's current tier meets or exceeds the required tier.
 * Treats null / undefined as 'free' — the safe default that never accidentally
 * grants access to a gated feature.
 *
 * Usage: if (!hasPlanAtLeast(profile.subscription_tier, 'basic')) redirect('/pricing');
 */
export function hasPlanAtLeast(
  tier: PlanTier | null | undefined,
  required: PlanTier,
): boolean {
  const rank = PLAN_RANK[tier ?? 'free'] ?? 0;
  return rank >= PLAN_RANK[required];
}
