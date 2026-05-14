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
    <main className="min-h-screen px-6 pb-20 pt-16">
      <div className="text-center">
        <div className="mb-3 text-xs font-semibold tracking-[0.3em] uppercase text-accent">
          Pricing
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-text">
          Simple, transparent pricing
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-text-muted">
          Choose the plan that fits your training goals. Upgrade or cancel anytime.
        </p>
      </div>

      <PricingCards
        tier={tier}
        basicPriceId={PRICE_IDS.basic}
        proPriceId={PRICE_IDS.pro}
      />
    </main>
  );
}
