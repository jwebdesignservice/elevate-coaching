import { Card } from '@/components/ui/card';
import type { ReactNode } from 'react';

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  delta?: string;
  trend?: ReactNode; // mini chart slot
}

export function StatCard({ icon, label, value, delta, trend }: StatCardProps) {
  return (
    <Card className="bg-surface border-border flex items-center gap-4 p-5">
      <div className="rounded-card bg-surface-hover text-accent flex h-10 w-10 shrink-0 items-center justify-center">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-text-muted text-[11px] font-medium tracking-[0.15em] uppercase">
          {label}
        </div>
        <div className="text-text mt-1 text-4xl leading-none font-bold tracking-tight">{value}</div>
        {delta && <div className="text-accent mt-1.5 text-xs font-medium">{delta}</div>}
      </div>
      {trend && <div className="ml-auto">{trend}</div>}
    </Card>
  );
}
