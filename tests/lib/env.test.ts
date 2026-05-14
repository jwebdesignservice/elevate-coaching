import { describe, it, expect } from 'vitest';

describe('env validation', () => {
  it('throws when required vars are missing', async () => {
    const original = process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    await expect(import('@/lib/env?reset')).rejects.toThrow();
    process.env.NEXT_PUBLIC_SUPABASE_URL = original;
  });

  it('parses a valid env without throwing', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_test';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test';
    process.env.NEXT_PUBLIC_COACH_WHATSAPP = '441234567890';
    process.env.NEXT_PUBLIC_COACH_CALENDLY = 'https://calendly.com/coach';
    process.env.STRIPE_SECRET_KEY = 'sk_test_fixture';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fixture';
    process.env.STRIPE_BASIC_PRICE_ID = 'price_basic_fixture';
    process.env.STRIPE_PRO_PRICE_ID = 'price_pro_fixture';
    const { env } = await import('@/lib/env?fresh');
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://test.supabase.co');
  });
});
