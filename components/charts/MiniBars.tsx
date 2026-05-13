/**
 * MiniBars — small vertical bar chart for the Active Streak stat card.
 * Heights are scaled to the highest value; bars are mint with a subtle
 * radius.
 */
interface MiniBarsProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  /** gap between bars in px */
  gap?: number;
}

export function MiniBars({ data, width = 80, height = 32, className, gap = 3 }: MiniBarsProps) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  const barWidth = (width - gap * (data.length - 1)) / data.length;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      aria-hidden
    >
      {data.map((v, i) => {
        const h = Math.max((v / max) * height, 2);
        const x = i * (barWidth + gap);
        const y = height - h;
        return <rect key={i} x={x} y={y} width={barWidth} height={h} rx="1" fill="#2DE3A8" />;
      })}
    </svg>
  );
}
