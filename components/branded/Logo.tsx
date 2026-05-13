interface LogoProps {
  variant?: 'full' | 'mark';
  className?: string;
}

export function Logo({ variant = 'full', className }: LogoProps) {
  return (
    <div
      className={
        variant === 'full'
          ? `flex flex-col items-center text-center ${className ?? ''}`
          : (className ?? '')
      }
    >
      <svg viewBox="0 0 64 64" className={variant === 'full' ? 'h-10 w-10' : 'h-8 w-8'} aria-hidden>
        <defs>
          <linearGradient id="elevate-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7CFCDD" />
            <stop offset="100%" stopColor="#2DE3A8" />
          </linearGradient>
        </defs>
        <path d="M32 8 L52 44 L40 44 L32 28 L24 44 L12 44 Z" fill="url(#elevate-grad)" />
        <path d="M32 22 L40 36 L24 36 Z" fill="url(#elevate-grad)" opacity="0.6" />
      </svg>
      {variant === 'full' && (
        <div className="mt-2">
          <div className="text-text text-xl font-bold tracking-[0.18em]">ELEVATE</div>
          <div className="text-text-muted text-[10px] tracking-[0.4em]">COACHING</div>
        </div>
      )}
    </div>
  );
}
