import Link from 'next/link';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProgramHeroProps {
  eyebrow: string;
  title: string;
  meta: string;
  progressPct: number;
  /** primary CTA (mint solid) */
  primary: { label: string; href: string };
  /** optional secondary CTA (outline) */
  secondary?: { label: string; href: string };
  /** Right-side visual treatment: subtle accent halo + figure silhouette.
   *  Pass false to suppress on smaller variants. */
  withFigure?: boolean;
}

/**
 * The dashboard's lead card. Mirrors the design-spec "Current Program"
 * tile: dark gradient surface, ambient mint glow top-right, optional
 * figure silhouette on the right, eyebrow + headline + meta, then a
 * progress bar with the percentage anchored to the bar's right edge,
 * then dual CTAs.
 *
 * Real program data lands in SP-5; until then this renders whatever the
 * caller passes (typically static demo content).
 */
export function ProgramHero({
  eyebrow,
  title,
  meta,
  progressPct,
  primary,
  secondary,
  withFigure = true,
}: ProgramHeroProps) {
  const pct = Math.max(0, Math.min(100, progressPct));

  return (
    <div className="border-border rounded-card from-surface via-surface to-surface-hover group/hero relative overflow-hidden border bg-gradient-to-br p-8 transition-colors hover:border-white/10">
      {/* ambient accent glow */}
      <div
        aria-hidden
        className="bg-accent/15 pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full blur-3xl"
      />

      {/* figure silhouette — abstract, hints at content without an asset */}
      {withFigure && (
        <svg
          aria-hidden
          viewBox="0 0 200 240"
          className="text-text-dim/30 pointer-events-none absolute -right-4 bottom-0 hidden h-[110%] w-auto md:block"
          fill="currentColor"
        >
          {/* simplified seated figure outline */}
          <circle cx="100" cy="40" r="22" />
          <path d="M70 80 L130 80 L138 160 L62 160 Z" />
          <path d="M58 162 L142 162 L150 220 L50 220 Z" />
          <path d="M50 130 L65 130 L62 175 L48 175 Z" />
          <path d="M135 130 L150 130 L152 175 L138 175 Z" />
        </svg>
      )}

      <div className="relative max-w-[60%]">
        <div className="text-accent mb-3 text-[11px] font-semibold tracking-[0.25em] uppercase">
          {eyebrow}
        </div>
        <h2 className="text-text mb-3 text-4xl font-bold tracking-tight">{title}</h2>
        <div className="text-text-muted mb-7 text-sm leading-relaxed">{meta}</div>

        {/* progress with end-anchored % label */}
        <div className="mb-7 max-w-md">
          <div className="rounded-pill bg-surface-hover relative h-1.5 w-full overflow-visible">
            <div
              className="rounded-pill bg-accent absolute inset-y-0 left-0 transition-[width] duration-700 ease-out"
              style={{ width: `${pct}%` }}
            />
            <span
              className="text-text absolute -top-6 text-sm font-semibold"
              style={{ left: `${pct}%`, transform: 'translateX(-100%)' }}
            >
              {pct}%
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            nativeButton={false}
            render={<Link href={primary.href} />}
            className="bg-accent text-accent-fg hover:bg-accent/90 transition-all"
          >
            <Play className="h-4 w-4" />
            {primary.label}
          </Button>
          {secondary && (
            <Button
              nativeButton={false}
              render={<Link href={secondary.href} />}
              variant="outline"
              className="border-border text-text hover:border-accent/40 transition-colors"
            >
              {secondary.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
