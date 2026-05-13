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
      <div className="rounded-card bg-surface-hover text-accent p-2">{icon}</div>
      <div className="flex-1">
        <div className="text-text-muted text-xs tracking-wide uppercase">{label}</div>
        <div className="text-text mt-1 text-3xl font-semibold">{value}</div>
        {delta && <div className="text-accent mt-1 text-xs">{delta}</div>}
      </div>
      {trend && <div className="ml-auto">{trend}</div>}
    </Card>
  );
}
