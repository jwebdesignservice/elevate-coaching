import { Card } from '@/components/ui/card';
import type { ReactNode } from 'react';

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  /** Small caption under the value — e.g. "+12% vs last week", "days in a row", "of 20 this week" */
  caption?: string;
  /** Tint of the caption: mint for positive deltas, muted otherwise */
  captionTone?: 'accent' | 'muted';
  /** Right-side visual slot — sparkline / donut / mini-bars */
  visual?: ReactNode;
}

/**
 * Stat tile matching the dashboard mockup:
 *
 *   ┌─[icon]─ Label ──────────[visual]─┐
 *   │                                  │
 *   │  Value                            │
 *   │  caption                          │
 *   └──────────────────────────────────┘
 *
 * Icon goes top-left in its own small rounded-square panel. Value is the
 * dominant element. Visual (chart) anchors to the right of the value row.
 * Card lifts subtly on hover.
 */
export function StatCard({
  icon,
  label,
  value,
  caption,
  captionTone = 'accent',
  visual,
}: StatCardProps) {
  return (
    <Card className="bg-surface border-border group/stat relative overflow-hidden p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/10 hover:shadow-lg hover:shadow-black/20">
      <div className="mb-3 flex items-center gap-2.5">
        <div className="bg-surface-hover text-accent flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
          {icon}
        </div>
        <div className="text-text-muted text-[12px] font-medium tracking-tight">{label}</div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-text text-3xl leading-none font-bold tracking-tight">{value}</div>
          {caption && (
            <div
              className={`mt-2 text-[11px] font-medium ${
                captionTone === 'accent' ? 'text-accent' : 'text-text-dim'
              }`}
            >
              {caption}
            </div>
          )}
        </div>
        {visual && (
          <div className="text-accent transition-transform duration-300 group-hover/stat:scale-105">
            {visual}
          </div>
        )}
      </div>
    </Card>
  );
}
