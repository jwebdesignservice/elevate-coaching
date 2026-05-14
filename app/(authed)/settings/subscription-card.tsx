'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import type { PlanTier } from '@/lib/plans';

const TIER_LABEL: Record<PlanTier, string> = {
  free:  'Free',
  basic: 'Basic',
  pro:   'Pro',
};

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

  const showAccessUntil = cancelAtPeriodEnd && periodEnd !== null;
  const accessUntilFormatted = periodEnd
    ? new Date(periodEnd).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <Card className="bg-surface border-border p-6">
      <h2 className="mb-4 text-xl font-semibold tracking-tight text-text">Subscription</h2>

      <div className="flex items-center gap-3">
        <span
          className={cn(
            'rounded-pill inline-flex items-center px-2.5 py-1 text-xs font-semibold',
            tier === 'free'  && 'bg-surface-hover text-text-muted',
            tier === 'basic' && 'bg-accent/15 text-accent',
            tier === 'pro'   && 'bg-accent text-accent-fg',
          )}
        >
          {TIER_LABEL[tier]}
        </span>
        <span className="text-sm text-text">{TIER_LABEL[tier]} Plan</span>
      </div>

      {showAccessUntil && (
        <p className="mt-3 text-sm text-text-muted">
          Access until{' '}
          <span className="font-medium text-text">{accessUntilFormatted}</span>
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {(tier === 'free' || tier === 'basic') && (
          <Link
            href="/pricing"
            className={cn(
              buttonVariants({ size: 'sm' }),
              'bg-accent text-accent-fg hover:bg-accent/90',
            )}
          >
            Upgrade →
          </Link>
        )}
        {(tier === 'basic' || tier === 'pro') && (
          <button
            onClick={openPortal}
            disabled={loading}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              loading && 'cursor-not-allowed opacity-60',
            )}
          >
            {loading ? 'Redirecting…' : 'Manage subscription →'}
          </button>
        )}
      </div>
    </Card>
  );
}
