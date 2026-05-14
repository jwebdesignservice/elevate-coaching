import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PRICE_IDS } from '@/lib/stripe';
import type { PlanTier } from '@/lib/plans';
import { PricingCards } from './pricing-cards';

export const metadata = {
  title: 'Pricing · Elevate Coaching',
};

export default async function PricingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let tier: PlanTier | null = null;
  if (user) {
    const { data: profileRaw } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();
    const profile = profileRaw as { subscription_tier: PlanTier } | null;
    tier = profile?.subscription_tier ?? 'free';
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-20">
      {/* Background halos */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-1/4 h-[400px] w-[400px] translate-y-1/2 rounded-full bg-accent/6 blur-[100px]"
      />
      {/* Subtle dot grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      <div className="relative z-10 w-full">
        {/* Header */}
        <div className="mb-14 text-center">
          <div className="mb-4 inline-flex items-center rounded-pill border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-semibold tracking-[0.25em] text-accent uppercase">
            Pricing
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-text">
            Simple, transparent pricing
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base text-text-muted">
            Choose the plan that fits your training goals. Upgrade or cancel anytime.
          </p>
        </div>

        <PricingCards
          tier={tier}
          basicPriceId={PRICE_IDS.basic}
          proPriceId={PRICE_IDS.pro}
        />
      </div>
    </main>
  );
}
