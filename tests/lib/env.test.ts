import { describe, it, expect } from 'vitest';

describe('env validation', () => {
  it('throws when required vars are missing', async () => {
    const original = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    await expect(import('@/lib/env?reset')).rejects.toThrow();
    process.env.DATABASE_URL = original;
  });

  it('parses a valid env without throwing', async () => {
    process.env.DATABASE_URL = 'postgres://test';
    process.env.CLERK_SECRET_KEY = 'sk_test_x';
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_x';
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_x';
    process.env.NEXT_PUBLIC_COACH_WHATSAPP = '441234567890';
    process.env.NEXT_PUBLIC_COACH_CALENDLY = 'https://calendly.com/coach';
    const { env } = await import('@/lib/env?fresh');
    expect(env.DATABASE_URL).toBe('postgres://test');
  });
});
