'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import type { PlanTier } from '@/lib/plans';

interface Plan {
  key: 'basic' | 'pro';
  name: string;
  price: string;
  tagline: string;
  priceId: string;
  features: string[];
  popular?: boolean;
}

const PLANS: Omit<Plan, 'priceId'>[] = [
  {
    key: 'basic',
    name: 'Basic',
    price: '£150',
    tagline: 'Everything you need to train smarter.',
    features: [
      'Full access to workout programmes',
      'Daily task assignments',
      'Tutorial exercise library',
      'WhatsApp coach access',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '£300',
    tagline: 'For athletes who want every edge.',
    features: [
      'Everything in Basic',
      'Priority coach response',
      'Advanced performance tracking',
      'Monthly 1:1 strategy call',
    ],
    popular: true,
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
    <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
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
                'bg-accent text-accent-fg hover:bg-accent/90 w-full hover:shadow-lg hover:shadow-accent/40',
                plan.popular && 'shadow-md shadow-accent/20',
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
          cta = plan.popular ? (
            <button
              onClick={() => handleCheckout(plan)}
              disabled={loading !== null}
              className={cn(
                buttonVariants(),
                'bg-accent text-accent-fg hover:bg-accent/90 w-full shadow-md shadow-accent/20 hover:shadow-xl hover:shadow-accent/50',
              )}
            >
              <Zap className="h-4 w-4 fill-current" />
              {loading === plan.key ? 'Redirecting…' : `Upgrade to ${plan.name}`}
            </button>
          ) : (
            <button
              onClick={() => handleCheckout(plan)}
              disabled={loading !== null}
              className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}
            >
              {loading === plan.key ? 'Redirecting…' : `Upgrade to ${plan.name}`}
            </button>
          );
        }

        return (
          <div
            key={plan.key}
            className={cn(
              'relative flex flex-col rounded-2xl border p-8 transition-all duration-300',
              plan.popular
                ? 'border-accent bg-surface shadow-2xl shadow-accent/10 ring-1 ring-accent/20 hover:-translate-y-2 hover:shadow-2xl hover:shadow-accent/25 hover:ring-accent/50'
                : 'border-border bg-surface hover:-translate-y-1 hover:border-accent/30 hover:shadow-xl hover:shadow-black/30',
            )}
          >
            {/* Most popular badge */}
            {plan.popular && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1 rounded-pill bg-accent px-3 py-1 text-xs font-semibold text-accent-fg shadow-lg shadow-accent/30">
                  <Zap className="h-3 w-3 fill-current" />
                  Most Popular
                </span>
              </div>
            )}

            {/* Plan name */}
            <div
              className={cn(
                'mb-2 text-xs font-semibold tracking-[0.3em] uppercase',
                plan.popular ? 'text-accent' : 'text-text-muted',
              )}
            >
              {plan.name}
            </div>

            {/* Price */}
            <div className="mb-1 flex items-end gap-1">
              <span className="text-5xl font-bold tracking-tight text-text">{plan.price}</span>
              <span className="mb-1.5 text-sm text-text-muted">/ month</span>
            </div>

            {/* Tagline */}
            <p className="mb-6 mt-2 text-sm text-text-muted">{plan.tagline}</p>

            {/* Divider */}
            <div className={cn('mb-6 h-px', plan.popular ? 'bg-accent/20' : 'bg-border')} />

            {/* Features */}
            <ul className="mb-8 flex-1 space-y-3">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-text">
                  <Check
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0',
                      plan.popular ? 'text-accent' : 'text-accent/70',
                    )}
                  />
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
