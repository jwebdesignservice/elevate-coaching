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
    <Card className="from-surface to-surface-hover border-border rounded-card relative overflow-hidden bg-gradient-to-br p-10">
      {/* subtle accent glow — visual weight without imagery */}
      <div
        aria-hidden
        className="bg-accent/15 pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl"
      />

      <div className="relative">
        <div className="text-accent mb-3 text-xs font-semibold tracking-[0.25em] uppercase">
          {eyebrow}
        </div>
        <h2 className="text-text mb-3 max-w-xl text-4xl font-bold tracking-tight">{title}</h2>
        <div className="text-text-muted mb-6 max-w-xl text-sm leading-relaxed">{meta}</div>

        <div className="mb-6 max-w-md">
          <div className="rounded-pill bg-surface-hover mb-2 h-2 w-full overflow-hidden">
            <div
              className="bg-accent rounded-pill h-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="text-text-muted text-xs font-medium">{progressPct}% complete</div>
        </div>

        <div className="flex flex-wrap gap-3">
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
      </div>
    </Card>
  );
}
