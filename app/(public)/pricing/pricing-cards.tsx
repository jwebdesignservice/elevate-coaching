'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import type { PlanTier } from '@/lib/plans';

interface Plan {
  key: 'basic' | 'pro';
  name: string;
  price: string;
  priceId: string;
  features: string[];
}

const PLANS: Omit<Plan, 'priceId'>[] = [
  {
    key: 'basic',
    name: 'Basic',
    price: '£150',
    features: [
      'Full access to workout programmes',
      'Daily task assignments',
      'Tutorial library',
      'WhatsApp coach access',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '£300',
    features: [
      'Everything in Basic',
      'Priority coach response',
      'Advanced performance tracking',
      'Monthly strategy call',
    ],
  },
];

interface Props {
  tier: PlanTier | null;
  basicPriceId: string;
  proPriceId: string;
}

export function PricingCards({ tier, basicPriceId, proPriceId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<'basic' | 'pro' | null>(null);

  const plans: Plan[] = [
    { ...PLANS[0]!, priceId: basicPriceId },
    { ...PLANS[1]!, priceId: proPriceId },
  ];

  async function handleCheckout(plan: Plan) {
    setLoading(plan.key);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: plan.priceId }),
      });
      if (!res.ok) throw new Error('Checkout failed');
      const { url } = (await res.json()) as { url: string };
      router.push(url);
    } catch {
      setLoading(null);
    }
  }

  return (
    <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
      {plans.map((plan) => {
        const isCurrent = tier === plan.key;
        const isProOnBasicCard = tier === 'pro' && plan.key === 'basic';

        let cta: React.ReactNode;

        if (!tier) {
          cta = (
            <Link
              href={`/sign-up?plan=${plan.key}`}
              className={cn(
                buttonVariants(),
                'bg-accent text-accent-fg hover:bg-accent/90 w-full',
              )}
            >
              Get started
            </Link>
          );
        } else if (isCurrent) {
          cta = (
            <button
              disabled
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'w-full cursor-not-allowed opacity-60',
              )}
            >
              Current plan
            </button>
          );
        } else if (isProOnBasicCard) {
          cta = (
            <Link
              href="/settings"
              className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}
            >
              Downgrade via portal
            </Link>
          );
        } else {
          cta = (
            <button
              onClick={() => handleCheckout(plan)}
              disabled={loading !== null}
              className={cn(
                buttonVariants(),
                'bg-accent text-accent-fg hover:bg-accent/90 w-full',
              )}
            >
              {loading === plan.key ? 'Redirecting…' : `Upgrade to ${plan.name}`}
            </button>
          );
        }

        return (
          <div
            key={plan.key}
            className={cn(
              'bg-surface border-border rounded-card flex flex-col border p-8',
              isCurrent && 'border-accent',
            )}
          >
            <div className="mb-2 text-xs font-semibold tracking-[0.3em] uppercase text-accent">
              {plan.name}
            </div>
            <div className="mb-1 text-4xl font-bold text-text">
              {plan.price}
              <span className="ml-1 text-base font-normal text-text-muted">/ month</span>
            </div>
            <ul className="mb-8 mt-6 flex-1 space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-text-muted">
                  <span className="mt-0.5 text-accent">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            {cta}
          </div>
        );
      })}
    </div>
  );
}
