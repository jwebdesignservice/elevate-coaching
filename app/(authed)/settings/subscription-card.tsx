'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, Lock, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import type { PlanTier } from '@/lib/plans';

const TIER_LABEL: Record<PlanTier, string> = {
  free:  'Free',
  basic: 'Basic',
  pro:   'Pro',
};

const FEATURES: { label: string; minTier: PlanTier }[] = [
  { label: 'Dashboard & progress tracking',  minTier: 'free'  },
  { label: 'Full workout programmes',         minTier: 'basic' },
  { label: 'Daily task assignments',          minTier: 'basic' },
  { label: 'Tutorial exercise library',       minTier: 'basic' },
  { label: 'WhatsApp coach access',           minTier: 'basic' },
  { label: 'Priority coach response',         minTier: 'pro'   },
  { label: 'Advanced performance tracking',   minTier: 'pro'   },
  { label: 'Monthly strategy call',           minTier: 'pro'   },
];

const TIER_RANK: Record<PlanTier, number> = { free: 0, basic: 1, pro: 2 };

interface Props {
  tier: PlanTier;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export function SubscriptionCard({ tier, periodEnd, cancelAtPeriodEnd }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function openPortal() {
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      if (!res.ok) throw new Error('Portal error');
      const { url } = (await res.json()) as { url: string };
      router.push(url);
    } catch {
      setLoading(false);
    }
  }

  const periodEndFormatted = periodEnd
    ? new Date(periodEnd).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <Card className="bg-surface border-border p-6">
      {/* Header row */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="mb-1 text-xl font-semibold tracking-tight text-text">Subscription</h2>
          {periodEndFormatted && (
            <p className="text-sm text-text-muted">
              {cancelAtPeriodEnd ? 'Access until' : 'Renews'}{' '}
              <span className="font-medium text-text">{periodEndFormatted}</span>
            </p>
          )}
          {!periodEndFormatted && tier === 'free' && (
            <p className="text-sm text-text-muted">No active subscription</p>
          )}
        </div>
        <span
          className={cn(
            'rounded-pill inline-flex items-center px-3 py-1 text-sm font-semibold',
            tier === 'free'  && 'bg-surface-hover text-text-muted',
            tier === 'basic' && 'bg-accent/15 text-accent',
            tier === 'pro'   && 'bg-accent text-accent-fg',
          )}
        >
          {TIER_LABEL[tier]} Plan
        </span>
      </div>

      {/* Feature list */}
      <ul className="mb-5 space-y-2">
        {FEATURES.map(({ label, minTier }) => {
          const unlocked = TIER_RANK[tier] >= TIER_RANK[minTier];
          const upgradeLabel = minTier === 'pro' ? 'Pro' : 'Basic';
          return (
            <li key={label} className="flex items-center gap-2.5 text-sm">
              {unlocked ? (
                <Check className="h-4 w-4 shrink-0 text-accent" />
              ) : (
                <Lock className="h-4 w-4 shrink-0 text-text-dim" />
              )}
              <span className={unlocked ? 'text-text' : 'text-text-muted'}>
                {label}
              </span>
              {!unlocked && (
                <span className="ml-auto rounded-pill bg-surface-hover px-2 py-0.5 text-[10px] font-medium text-text-dim">
                  {upgradeLabel}+
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {/* CTAs */}
      <div className="flex flex-wrap gap-3">
        {tier === 'free' && (
          <>
            <Link
              href="/pricing"
              className={cn(
                buttonVariants(),
                'bg-accent text-accent-fg hover:bg-accent/25 hover:text-white hover:border-accent/60',
              )}
            >
              <Zap className="h-4 w-4 fill-current" />
              Upgrade plan
            </Link>
            <Link
              href="/pricing"
              className={cn(buttonVariants({ variant: 'outline' }))}
            >
              View pricing
            </Link>
          </>
        )}
        {tier === 'basic' && (
          <>
            <button
              onClick={openPortal}
              disabled={loading}
              className={cn(
                buttonVariants({ variant: 'outline' }),
                loading && 'cursor-not-allowed opacity-60',
              )}
            >
              {loading ? 'Redirecting…' : 'Manage subscription'}
            </button>
            <Link
              href="/pricing"
              className={cn(
                buttonVariants(),
                'bg-accent text-accent-fg hover:bg-accent/25 hover:text-white hover:border-accent/60',
              )}
            >
              <Zap className="h-4 w-4 fill-current" />
              Upgrade to Pro
            </Link>
          </>
        )}
        {tier === 'pro' && (
          <button
            onClick={openPortal}
            disabled={loading}
            className={cn(
              buttonVariants({ variant: 'outline' }),
              loading && 'cursor-not-allowed opacity-60',
            )}
          >
            {loading ? 'Redirecting…' : 'Manage subscription'}
          </button>
        )}
      </div>
    </Card>
  );
}
