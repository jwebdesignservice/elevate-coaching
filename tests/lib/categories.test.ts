import { describe, it, expect } from 'vitest';
import {
  CATEGORIES,
  CATEGORY_INFO,
  categoryName,
  isCategory,
  type Category,
} from '@/lib/categories';

describe('lib/categories', () => {
  describe('CATEGORIES', () => {
    it('has exactly four entries in A, B, C, D order', () => {
      expect(CATEGORIES).toEqual(['A', 'B', 'C', 'D']);
    });

    it('has no duplicates', () => {
      expect(new Set(CATEGORIES).size).toBe(CATEGORIES.length);
    });
  });

  describe('CATEGORY_INFO', () => {
    it('has an entry for every code in CATEGORIES', () => {
      for (const code of CATEGORIES) {
        const info = CATEGORY_INFO[code];
        expect(info).toBeDefined();
        expect(info.code).toBe(code);
      }
    });

    it('has the agreed names verbatim', () => {
      expect(CATEGORY_INFO.A.name).toBe('Beginner');
      expect(CATEGORY_INFO.B.name).toBe('Fat Loss');
      expect(CATEGORY_INFO.C.name).toBe('Strength');
      expect(CATEGORY_INFO.D.name).toBe('Advanced');
    });

    it('every entry has a non-empty tagline and description', () => {
      for (const code of CATEGORIES) {
        const info = CATEGORY_INFO[code];
        expect(info.tagline.length).toBeGreaterThan(0);
        expect(info.description.length).toBeGreaterThan(20);
      }
    });
  });

  describe('isCategory', () => {
    it.each(CATEGORIES)('returns true for "%s"', (code) => {
      expect(isCategory(code)).toBe(true);
    });

    it.each([
      ['lowercase a', 'a'],
      ['random string', 'beginner'],
      ['empty string', ''],
      ['null', null],
      ['undefined', undefined],
      ['number', 1],
      ['object', {}],
      ['array', ['A']],
    ])('returns false for %s', (_label, value) => {
      expect(isCategory(value)).toBe(false);
    });

    it('narrows the type when true', () => {
      const input: unknown = 'B';
      if (isCategory(input)) {
        // If this assignment compiles, the narrow worked.
        const code: Category = input;
        expect(code).toBe('B');
      } else {
        throw new Error('expected narrow to succeed');
      }
    });
  });

  describe('categoryName', () => {
    it('returns the display name for a valid code', () => {
      expect(categoryName('A')).toBe('Beginner');
      expect(categoryName('D')).toBe('Advanced');
    });

    it('returns the fallback for null', () => {
      expect(categoryName(null)).toBe('No category yet');
    });

    it('returns the fallback for undefined', () => {
      expect(categoryName(undefined)).toBe('No category yet');
    });
  });
});
