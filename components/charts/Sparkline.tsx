/**
 * Sparkline — tiny inline SVG line chart for stat-card trend slots and the
 * Performance Overview hero number. Pure SVG, no JS runtime, zero deps.
 *
 * Pass an array of numbers — the component scales them into the viewBox.
 * `area` adds a soft gradient fill below the line for the larger
 * Performance-Overview variant. Single line is the default for stat cards.
 */
interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  strokeWidth?: number;
  area?: boolean;
  /** unique id so multiple sparklines on a page don't share gradient defs */
  id?: string;
}

export function Sparkline({
  data,
  width = 80,
  height = 32,
  className,
  strokeWidth = 1.75,
  area = false,
  id = 'spark',
}: SparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - strokeWidth * 2) - strokeWidth;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  const areaPath = area
    ? `M ${data
        .map((v, i) => {
          const x = i * stepX;
          const y = height - ((v - min) / range) * (height - strokeWidth * 2) - strokeWidth;
          return `${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(' L ')} L ${width},${height} L 0,${height} Z`
    : null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      aria-hidden
    >
      {area && (
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2DE3A8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#2DE3A8" stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {area && areaPath && <path d={areaPath} fill={`url(#${id}-fill)`} />}
      <polyline
        points={points}
        fill="none"
        stroke="#2DE3A8"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
