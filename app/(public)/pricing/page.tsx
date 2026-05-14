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
      {/* Background — top centre halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-accent/20 blur-[140px]"
      />
      {/* Bottom-right accent bleed */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -right-20 h-[500px] w-[500px] rounded-full bg-accent/12 blur-[120px]"
      />
      {/* Bottom-left warm bleed for depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-10 -left-10 h-[350px] w-[350px] rounded-full bg-accent/8 blur-[100px]"
      />
      {/* Dot grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      {/* Top vignette to ground the header text */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background to-transparent"
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
