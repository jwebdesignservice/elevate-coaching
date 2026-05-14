import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Stripe from 'stripe';

// vi.hoisted ensures these mock fns are available inside vi.mock() factories,
// which are hoisted before module imports by Vitest.
const mocks = vi.hoisted(() => ({
  constructEvent:           vi.fn(),
  subscriptionsRetrieve:    vi.fn(),
  tierFromPriceId:          vi.fn(),
  updateEq:                 vi.fn(),
  updateChain:              vi.fn(),
  fromFn:                   vi.fn(),
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks:      { constructEvent: mocks.constructEvent },
    subscriptions: { retrieve: mocks.subscriptionsRetrieve },
  },
  tierFromPriceId: mocks.tierFromPriceId,
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseAdminClient:  mocks.createSupabaseAdminClient,
}));

vi.mock('@/lib/env', () => ({
  env: {
    STRIPE_SECRET_KEY:             'sk_test_mock',
    STRIPE_WEBHOOK_SECRET:         'whsec_test_mock',
    STRIPE_BASIC_PRICE_ID:         'price_basic_mock',
    STRIPE_PRO_PRICE_ID:           'price_pro_mock',
    NEXT_PUBLIC_SUPABASE_URL:      'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon_mock',
    SUPABASE_SERVICE_ROLE_KEY:     'service_role_mock',
    NEXT_PUBLIC_COACH_WHATSAPP:    '+1234567890',
    NEXT_PUBLIC_COACH_CALENDLY:    'https://calendly.com/test',
    NODE_ENV: 'test',
  },
}));

function makeRequest(body: string, sig = 'valid-sig') {
  return new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': sig },
    body,
  });
}

describe('POST /api/stripe/webhook', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Re-apply chain mock implementations that vi.resetAllMocks() removed
    mocks.updateEq.mockResolvedValue({ error: null });
    mocks.updateChain.mockReturnValue({ eq: mocks.updateEq });
    mocks.fromFn.mockReturnValue({ update: mocks.updateChain });
    mocks.createSupabaseAdminClient.mockReturnValue({ from: mocks.fromFn });
    mocks.tierFromPriceId.mockReturnValue('basic');
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('returns 400 when Stripe signature verification fails', async () => {
    mocks.constructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature for payload');
    });
    const { POST } = await import('@/app/api/stripe/webhook/route');
    const res = await POST(makeRequest('{}', 'bad-sig'));
    expect(res.status).toBe(400);
  });

  it('checkout.session.completed — writes customer id, subscription id, tier, period end', async () => {
    const mockSubscription = {
      id: 'sub_123',
      items: { data: [{ price: { id: 'price_basic_mock' } }] },
      current_period_end: 1800000000,
      cancel_at_period_end: false,
      status: 'active',
    } as unknown as Stripe.Subscription;

    const mockEvent = {
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata:     { supabase_user_id: 'user-abc-123' },
          customer:     'cus_mock_123',
          subscription: 'sub_123',
        } as unknown as Stripe.Checkout.Session,
      },
    } as Stripe.Event;

    mocks.constructEvent.mockReturnValue(mockEvent);
    mocks.subscriptionsRetrieve.mockResolvedValue(mockSubscription);
    mocks.tierFromPriceId.mockReturnValue('basic');

    const { POST } = await import('@/app/api/stripe/webhook/route');
    const res = await POST(makeRequest('{}'));

    expect(res.status).toBe(200);
    expect(mocks.updateChain).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_customer_id:               'cus_mock_123',
        stripe_subscription_id:           'sub_123',
        subscription_tier:                'basic',
        subscription_cancel_at_period_end: false,
      }),
    );
    expect(mocks.updateEq).toHaveBeenCalledWith('id', 'user-abc-123');
  });

  it('customer.subscription.updated (active) — re-syncs tier and period end', async () => {
    const mockEvent = {
      type: 'customer.subscription.updated',
      data: {
        object: {
          id:                   'sub_123',
          customer:             'cus_mock_123',
          status:               'active',
          items:                { data: [{ price: { id: 'price_pro_mock' } }] },
          current_period_end:   1800000000,
          cancel_at_period_end: false,
        } as unknown as Stripe.Subscription,
      },
    } as Stripe.Event;

    mocks.constructEvent.mockReturnValue(mockEvent);
    mocks.tierFromPriceId.mockReturnValue('pro');

    const { POST } = await import('@/app/api/stripe/webhook/route');
    const res = await POST(makeRequest('{}'));

    expect(res.status).toBe(200);
    expect(mocks.updateChain).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_tier:                'pro',
        stripe_subscription_id:           'sub_123',
        subscription_cancel_at_period_end: false,
      }),
    );
    expect(mocks.updateEq).toHaveBeenCalledWith('stripe_customer_id', 'cus_mock_123');
  });

  it('customer.subscription.deleted — downgrades to free and clears billing columns', async () => {
    const mockEvent = {
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id:       'sub_123',
          customer: 'cus_mock_123',
        } as unknown as Stripe.Subscription,
      },
    } as Stripe.Event;

    mocks.constructEvent.mockReturnValue(mockEvent);

    const { POST } = await import('@/app/api/stripe/webhook/route');
    const res = await POST(makeRequest('{}'));

    expect(res.status).toBe(200);
    expect(mocks.updateChain).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_tier:                'free',
        stripe_subscription_id:           null,
        subscription_period_end:          null,
        subscription_cancel_at_period_end: false,
      }),
    );
    expect(mocks.updateEq).toHaveBeenCalledWith('stripe_customer_id', 'cus_mock_123');
  });

  it('unrecognised event type — returns 200 and makes no DB calls', async () => {
    const mockEvent = {
      type: 'payment_intent.created',
      data: { object: {} },
    } as Stripe.Event;

    mocks.constructEvent.mockReturnValue(mockEvent);

    const { POST } = await import('@/app/api/stripe/webhook/route');
    const res = await POST(makeRequest('{}'));

    expect(res.status).toBe(200);
    expect(mocks.updateChain).not.toHaveBeenCalled();
  });
});
