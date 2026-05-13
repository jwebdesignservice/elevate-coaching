import { Play } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface VideoTutorialCardProps {
  index: number;
  title: string;
  description: string;
  duration: string;
  /** Lucide icon to render on the placeholder thumbnail until real thumbnails ship. */
  Icon: LucideIcon;
  /** Tailwind gradient classes for the thumbnail bg — varies the row visually. */
  gradient?: string;
}

/**
 * Tutorial card with a stylized gradient thumbnail (no real assets yet —
 * SP-6 wires the CDN), duration badge, numbered title, and one-line
 * description. Lift + reveal-play-icon on hover.
 */
export function VideoTutorialCard({
  index,
  title,
  description,
  duration,
  Icon,
  gradient = 'from-zinc-800 via-zinc-900 to-black',
}: VideoTutorialCardProps) {
  return (
    <button
      type="button"
      className="bg-surface border-border rounded-card group/video focus-visible:ring-accent/40 relative flex flex-col overflow-hidden border text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-white/10 hover:shadow-lg hover:shadow-black/30 focus-visible:ring-2 focus-visible:outline-none"
    >
      {/* Thumbnail */}
      <div
        className={`relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br ${gradient}`}
      >
        {/* placeholder visual — large activity icon on gradient */}
        <Icon
          className="text-text-dim/40 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 group-hover/video:scale-110 group-hover/video:text-white/40"
          style={{ width: '40%', height: '40%' }}
          strokeWidth={1.2}
        />
        {/* dim vignette */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"
        />
        {/* play overlay reveals on hover */}
        <div
          aria-hidden
          className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover/video:opacity-100"
        >
          <div className="bg-accent text-accent-fg flex h-11 w-11 items-center justify-center rounded-full shadow-lg">
            <Play className="h-5 w-5 fill-current" />
          </div>
        </div>
        {/* duration badge */}
        <span className="absolute right-2.5 bottom-2.5 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium tracking-tight text-white backdrop-blur-sm">
          {duration}
        </span>
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="text-text text-sm font-semibold tracking-tight">
          {index}. {title}
        </div>
        <div className="text-text-muted mt-1 text-xs leading-relaxed">{description}</div>
      </div>
    </button>
  );
}
