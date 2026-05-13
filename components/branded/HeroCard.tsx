import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';

interface HeroCardProps {
  eyebrow: string;
  title: string;
  meta: string;
  progressPct: number;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
}

export function HeroCard({
  eyebrow,
  title,
  meta,
  progressPct,
  primaryCta,
  secondaryCta,
}: HeroCardProps) {
  return (
    <Card className="from-surface to-surface-hover border-border rounded-card bg-gradient-to-br p-8">
      <div className="text-accent mb-2 text-xs tracking-widest uppercase">{eyebrow}</div>
      <h2 className="text-text mb-2 text-3xl font-semibold">{title}</h2>
      <div className="text-text-muted mb-4 text-sm">{meta}</div>
      <div className="rounded-pill bg-surface-hover mb-2 h-1 w-full overflow-hidden">
        <div className="bg-accent rounded-pill h-full" style={{ width: `${progressPct}%` }} />
      </div>
      <div className="text-text-muted mb-4 text-xs">{progressPct}%</div>
      <div className="flex gap-3">
        <Button
          nativeButton={false}
          render={<a href={primaryCta.href} />}
          className="bg-accent text-accent-fg hover:bg-accent/90"
        >
          <Play className="h-4 w-4" />
          {primaryCta.label}
        </Button>
        {secondaryCta && (
          <Button
            nativeButton={false}
            render={<a href={secondaryCta.href} />}
            variant="outline"
            className="border-border text-text"
          >
            {secondaryCta.label}
          </Button>
        )}
      </div>
    </Card>
  );
}
