import { describe, it, expect } from 'vitest';
import { hasPlanAtLeast, PLAN_TIERS } from '@/lib/plans';

describe('PLAN_TIERS', () => {
  it('contains free, basic, pro in ascending order', () => {
    expect(PLAN_TIERS).toEqual(['free', 'basic', 'pro']);
  });
});

describe('hasPlanAtLeast', () => {
  // Same-tier checks
  it('free >= free → true', () => expect(hasPlanAtLeast('free', 'free')).toBe(true));
  it('basic >= basic → true', () => expect(hasPlanAtLeast('basic', 'basic')).toBe(true));
  it('pro >= pro → true', () => expect(hasPlanAtLeast('pro', 'pro')).toBe(true));

  // Upward checks
  it('basic >= free → true', () => expect(hasPlanAtLeast('basic', 'free')).toBe(true));
  it('pro >= free → true', () => expect(hasPlanAtLeast('pro', 'free')).toBe(true));
  it('pro >= basic → true', () => expect(hasPlanAtLeast('pro', 'basic')).toBe(true));

  // Downward checks (must fail)
  it('free >= basic → false', () => expect(hasPlanAtLeast('free', 'basic')).toBe(false));
  it('free >= pro → false', () => expect(hasPlanAtLeast('free', 'pro')).toBe(false));
  it('basic >= pro → false', () => expect(hasPlanAtLeast('basic', 'pro')).toBe(false));

  // null / undefined treated as 'free' (safe default — never accidentally grants access)
  it('null >= free → true (null treated as free)', () =>
    expect(hasPlanAtLeast(null, 'free')).toBe(true));
  it('null >= basic → false (null treated as free)', () =>
    expect(hasPlanAtLeast(null, 'basic')).toBe(false));
  it('undefined >= free → true (undefined treated as free)', () =>
    expect(hasPlanAtLeast(undefined, 'free')).toBe(true));
  it('undefined >= basic → false (undefined treated as free)', () =>
    expect(hasPlanAtLeast(undefined, 'basic')).toBe(false));
});
