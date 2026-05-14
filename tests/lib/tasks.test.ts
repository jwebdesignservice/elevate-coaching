import { describe, it, expect } from 'vitest';
import {
  isoDayOfWeek,
  getMondayOf,
  toIsoDate,
  todayCompletionPct,
  currentStreak,
  bestStreak,
} from '@/lib/tasks';

describe('isoDayOfWeek', () => {
  it('Monday is 1', () => {
    expect(isoDayOfWeek(new Date(2026, 4, 18))).toBe(1); // Mon 18 May 2026
  });
  it('Sunday is 7', () => {
    expect(isoDayOfWeek(new Date(2026, 4, 24))).toBe(7); // Sun 24 May 2026
  });
  it('Wednesday is 3', () => {
    expect(isoDayOfWeek(new Date(2026, 4, 20))).toBe(3); // Wed 20 May 2026
  });
});

describe('getMondayOf', () => {
  it('returns the same day when passed a Monday', () => {
    const monday = new Date(2026, 4, 18, 14, 30); // Mon 18 May 14:30
    const result = getMondayOf(monday);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(4);
    expect(result.getDate()).toBe(18);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });

  it('returns previous Monday when passed a Wednesday', () => {
    const wed = new Date(2026, 4, 20, 9, 0); // Wed 20 May
    const result = getMondayOf(wed);
    expect(result.getDate()).toBe(18); // → Mon 18 May
  });

  it('returns previous Monday when passed a Sunday', () => {
    const sun = new Date(2026, 4, 24, 23, 59); // Sun 24 May
    const result = getMondayOf(sun);
    expect(result.getDate()).toBe(18); // → Mon 18 May
  });
});

describe('toIsoDate', () => {
  it('formats as YYYY-MM-DD in local time', () => {
    expect(toIsoDate(new Date(2026, 4, 18))).toBe('2026-05-18');
    expect(toIsoDate(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(toIsoDate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('todayCompletionPct', () => {
  it('returns 0 when total is 0 (rest day)', () => {
    expect(todayCompletionPct(0, 0)).toBe(0);
  });
  it('returns 0 when no tasks done', () => {
    expect(todayCompletionPct(6, 0)).toBe(0);
  });
  it('returns 100 when all tasks done', () => {
    expect(todayCompletionPct(6, 6)).toBe(100);
  });
  it('rounds to nearest integer', () => {
    expect(todayCompletionPct(3, 1)).toBe(33);
    expect(todayCompletionPct(3, 2)).toBe(67);
  });
});

describe('currentStreak', () => {
  const today = '2026-05-20'; // Wed

  it('returns 0 when rollup is empty', () => {
    expect(currentStreak([], today)).toBe(0);
  });

  it('counts a single perfect day (yesterday) as 1 if today is partial', () => {
    expect(
      currentStreak(
        [
          { date: '2026-05-19', total: 4, done: 4 }, // Tue perfect
          { date: '2026-05-20', total: 5, done: 2 }, // today partial
        ],
        today,
      ),
    ).toBe(1);
  });

  it('counts today inclusively when today is perfect', () => {
    expect(
      currentStreak(
        [
          { date: '2026-05-19', total: 4, done: 4 },
          { date: '2026-05-20', total: 5, done: 5 },
        ],
        today,
      ),
    ).toBe(2);
  });

  it('breaks at the first non-perfect, non-rest day', () => {
    expect(
      currentStreak(
        [
          { date: '2026-05-17', total: 3, done: 3 },
          { date: '2026-05-18', total: 4, done: 2 }, // breaks here
          { date: '2026-05-19', total: 4, done: 4 },
          { date: '2026-05-20', total: 5, done: 5 },
        ],
        today,
      ),
    ).toBe(2);
  });

  it('skips rest days (total === 0) without breaking the streak', () => {
    expect(
      currentStreak(
        [
          { date: '2026-05-17', total: 3, done: 3 }, // Sun perfect
          { date: '2026-05-18', total: 0, done: 0 }, // Mon rest
          { date: '2026-05-19', total: 4, done: 4 }, // Tue perfect
          { date: '2026-05-20', total: 5, done: 5 }, // Wed perfect
        ],
        today,
      ),
    ).toBe(3);
  });

  it('handles future days in the rollup (ignored)', () => {
    expect(
      currentStreak(
        [
          { date: '2026-05-19', total: 4, done: 4 },
          { date: '2026-05-20', total: 5, done: 5 },
          { date: '2026-05-21', total: 5, done: 0 }, // tomorrow
        ],
        today,
      ),
    ).toBe(2);
  });

  it('treats pre-signup days (total === 0 via adjustedRollup) as rest', () => {
    expect(
      currentStreak(
        [
          { date: '2026-05-18', total: 0, done: 0 }, // pre-signup
          { date: '2026-05-19', total: 4, done: 4 }, // first day post-signup
          { date: '2026-05-20', total: 5, done: 5 },
        ],
        today,
      ),
    ).toBe(2);
  });
});

describe('bestStreak', () => {
  it('returns 0 for empty rollup', () => {
    expect(bestStreak([])).toBe(0);
  });

  it('returns 0 when no day is perfect', () => {
    expect(
      bestStreak([
        { date: '2026-05-18', total: 4, done: 2 },
        { date: '2026-05-19', total: 4, done: 3 },
      ]),
    ).toBe(0);
  });

  it('finds the longest run', () => {
    expect(
      bestStreak([
        { date: '2026-05-15', total: 3, done: 3 },
        { date: '2026-05-16', total: 3, done: 3 },
        { date: '2026-05-17', total: 3, done: 1 }, // breaks
        { date: '2026-05-18', total: 3, done: 3 },
        { date: '2026-05-19', total: 3, done: 3 },
        { date: '2026-05-20', total: 3, done: 3 }, // longest = 3
      ]),
    ).toBe(3);
  });

  it('skips rest days when extending the run', () => {
    expect(
      bestStreak([
        { date: '2026-05-15', total: 3, done: 3 },
        { date: '2026-05-16', total: 0, done: 0 }, // rest
        { date: '2026-05-17', total: 3, done: 3 },
      ]),
    ).toBe(2);
  });
});
