import { useEffect, useMemo, useRef, useState } from 'react';

interface Point {
  ts: number;
  rating: number;
}

const HEIGHT = 220;
const PAD = { left: 44, right: 52, top: 14, bottom: 26 };
const SURFACE = '#302b27';
const LINE = '#f08a6e';

/** Rating after each rated puzzle, with a crosshair tooltip. */
export function RatingChart({ points }: { points: Point[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    const ratings = points.map((p) => p.rating);
    const step = Math.max(...ratings) - Math.min(...ratings) > 300 ? 100 : 50;
    const min = Math.floor((Math.min(...ratings) - 10) / step) * step;
    const max = Math.ceil((Math.max(...ratings) + 10) / step) * step;
    const innerW = Math.max(10, width - PAD.left - PAD.right);
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const x = (i: number) => PAD.left + (points.length === 1 ? innerW : (i / (points.length - 1)) * innerW);
    const y = (r: number) => PAD.top + (1 - (r - min) / (max - min || 1)) * innerH;
    const ticks: number[] = [];
    for (let t = min; t <= max; t += step) ticks.push(t);
    const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.rating).toFixed(1)}`).join('');
    return { x, y, ticks, path, innerW };
  }, [points, width]);

  if (points.length < 2) {
    return <div className="py-10 text-center text-sm text-muted">Giải vài puzzle tính điểm để xem biểu đồ rating.</div>;
  }

  const last = points.length - 1;
  const onPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left - PAD.left) / geo.innerW;
    setHover(Math.max(0, Math.min(last, Math.round(rel * last))));
  };
  const h = hover !== null ? points[hover] : null;

  return (
    <div ref={ref} className="relative w-full">
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={`Biểu đồ rating: từ ${points[0].rating} đến ${points[last].rating}`}
        onPointerMove={onPointer}
        onPointerLeave={() => setHover(null)}
        className="block touch-none"
      >
        {geo.ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={geo.y(t)} y2={geo.y(t)} stroke="rgba(255,255,255,0.08)" />
            <text x={PAD.left - 8} y={geo.y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="#a8a29e">
              {t}
            </text>
          </g>
        ))}
        <text x={PAD.left} y={HEIGHT - 6} fontSize="11" fill="#a8a29e">
          Bắt đầu
        </text>
        <text x={width - PAD.right} y={HEIGHT - 6} fontSize="11" fill="#a8a29e" textAnchor="end">
          {points.length - 1} puzzle
        </text>
        <path d={geo.path} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={geo.x(last)} cy={geo.y(points[last].rating)} r={4} fill={LINE} stroke={SURFACE} strokeWidth={2} />
        <text
          x={geo.x(last) + 8}
          y={geo.y(points[last].rating)}
          dy="0.32em"
          fontSize="12"
          fontWeight="700"
          fill="#f5f5f4"
        >
          {points[last].rating}
        </text>
        {h && hover !== null && (
          <g pointerEvents="none">
            <line
              x1={geo.x(hover)}
              x2={geo.x(hover)}
              y1={PAD.top}
              y2={HEIGHT - PAD.bottom}
              stroke="rgba(255,255,255,0.35)"
            />
            <circle cx={geo.x(hover)} cy={geo.y(h.rating)} r={4} fill={LINE} stroke={SURFACE} strokeWidth={2} />
          </g>
        )}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 rounded-lg bg-black/85 px-3 py-2 text-xs shadow-lg"
          style={{
            left: Math.min(width - 150, Math.max(0, geo.x(hover) - 70)),
          }}
        >
          <div className="text-base font-bold text-white">{h.rating}</div>
          <div className="text-muted">
            {hover === 0 ? 'Bắt đầu' : `Sau puzzle ${hover}`} · {new Date(h.ts).toLocaleDateString('vi-VN')}
          </div>
        </div>
      )}
    </div>
  );
}
