/**
 * Tiny inline-SVG sparkline (no chart lib — repo rule: no new dependencies).
 * Colors follow `currentColor`, so the parent picks the tone via text-* class.
 */

interface Props {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
}

export default function Sparkline({ data, width = 96, height = 28, className }: Props) {
  if (data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const stepX = width / (data.length - 1);
  // 2px vertical padding so the stroke never clips at the edges.
  const points = data.map((v, i) => ({
    x: i * stepX,
    y: height - 2 - ((v - min) / span) * (height - 4),
  }));
  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      aria-hidden="true"
    >
      <path d={area} fill="currentColor" opacity={0.12} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
