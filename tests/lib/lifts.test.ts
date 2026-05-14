import { describe, it, expect } from 'vitest';
import { calcWeight } from '@/lib/lifts';

describe('calcWeight', () => {
  const profile = {
    max_lift_squat: 100,
    max_lift_bench: 80,
    max_lift_deadlift: 120,
    max_lift_ohp: 60,
  };

  it('returns pct label when no max lift recorded for key', () => {
    expect(calcWeight(75, 'squat', { ...profile, max_lift_squat: null })).toBe('75% 1RM');
  });

  it('returns pct label when lift_key is null', () => {
    expect(calcWeight(75, null, profile)).toBe('75% 1RM');
  });

  it('returns pct label when lift_key is unknown', () => {
    expect(calcWeight(75, 'unknown', profile)).toBe('75% 1RM');
  });

  it('calculates squat weight correctly (rounds to 0.5kg)', () => {
    expect(calcWeight(75, 'squat', profile)).toBe('75% 1RM → 75 kg');
  });

  it('calculates bench weight correctly', () => {
    expect(calcWeight(80, 'bench', profile)).toBe('80% 1RM → 64 kg');
  });

  it('rounds to nearest 0.5kg', () => {
    // 75% of 101kg = 75.75kg → rounds to 76kg
    expect(calcWeight(75, 'squat', { ...profile, max_lift_squat: 101 })).toBe('75% 1RM → 76 kg');
    // 75% of 103kg = 77.25kg → rounds to 77.5kg
    expect(calcWeight(75, 'squat', { ...profile, max_lift_squat: 103 })).toBe('75% 1RM → 77.5 kg');
  });

  it('handles ohp key', () => {
    expect(calcWeight(85, 'ohp', profile)).toBe('85% 1RM → 51 kg');
  });

  it('handles deadlift key', () => {
    expect(calcWeight(90, 'deadlift', profile)).toBe('90% 1RM → 108 kg');
  });
});
