'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Sparkline } from '@/components/charts/Sparkline';

const PERIODS = ['7D', '30D', '90D'] as const;
type Period = (typeof PERIODS)[number];

interface PerformanceOverviewProps {
  /** label for the headline number (e.g. "Strength Score") */
  metricLabel: string;
  /** map of period → demo data (the chart re-renders when the toggle changes) */
  series: Record<Period, { value: string; delta: string; data: number[] }>;
  defaultPeriod?: Period;
}

/**
 * Performance Overview rail card with a 7D/30D/90D toggle. State stays
 * local — the parent passes pre-computed series for each period (real
 * fetching arrives in SP-4).
 */
export function PerformanceOverview({
  metricLabel,
  series,
  defaultPeriod = '30D',
}: PerformanceOverviewProps) {
  const [period, setPeriod] = useState<Period>(defaultPeriod);
  const active = series[period];

  return (
    <Card className="bg-surface border-border p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-text font-semibold tracking-tight">Performance Overview</h3>
        <div className="bg-surface-hover flex items-center gap-0.5 rounded-md p-0.5 text-[11px] font-medium">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded px-2 py-0.5 transition-colors ${
                p === period ? 'bg-accent text-accent-fg' : 'text-text-muted hover:text-text'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="text-text-muted mb-1.5 text-xs">{metricLabel}</div>
      <div className="text-text mb-1 text-4xl font-bold tracking-tight">{active.value}</div>
      <div className="text-accent mb-4 text-xs font-medium">{active.delta}</div>

      <Sparkline data={active.data} width={260} height={64} strokeWidth={2} area id="perf" />
    </Card>
  );
}
