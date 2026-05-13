/**
 * CircularProgress — donut-shaped progress indicator used in stat cards
 * and the active-program rail. Mint stroke on a subtle dark track.
 *
 * `value` is 0–100. `label` renders centered inside the donut (e.g. the
 * percentage); pass an empty string to omit.
 */
interface CircularProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  className?: string;
}

export function CircularProgress({
  value,
  size = 56,
  strokeWidth = 5,
  label,
  className,
}: CircularProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className={`relative inline-flex shrink-0 ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#2DE3A8"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      {label && (
        <span className="text-text absolute inset-0 flex items-center justify-center text-[10px] font-semibold">
          {label}
        </span>
      )}
    </div>
  );
}
