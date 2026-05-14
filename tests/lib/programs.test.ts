import { describe, it, expect } from 'vitest';
import { programProgressPct } from '@/lib/programs';

describe('programProgressPct', () => {
  it('returns 0 when total is 0', () => {
    expect(programProgressPct(0, 0)).toBe(0);
  });

  it('returns 0 when no sessions completed', () => {
    expect(programProgressPct(12, 0)).toBe(0);
  });

  it('returns 100 when all sessions completed', () => {
    expect(programProgressPct(12, 12)).toBe(100);
  });

  it('rounds to nearest integer', () => {
    expect(programProgressPct(3, 1)).toBe(33);
    expect(programProgressPct(3, 2)).toBe(67);
  });

  it('handles partial progress', () => {
    expect(programProgressPct(20, 5)).toBe(25);
    expect(programProgressPct(12, 8)).toBe(67);
  });
});
