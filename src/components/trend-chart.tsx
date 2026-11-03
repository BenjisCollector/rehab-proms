import type { Instrument } from "@/lib/fhir/questionnaires";

export interface Point {
  date: string;
  total: number;
}

const W = 640;
const H = 220;
const PAD = { top: 12, right: 16, bottom: 28, left: 36 };
const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

/**
 * Server-rendered SVG line chart. The SVG is decorative for assistive tech; the
 * same numbers are always available in the table that follows it on the page.
 */
export function TrendChart({ instrument, points }: { instrument: Instrument; points: Point[] }) {
  if (points.length === 0) return <p>No {instrument.shortName} answers yet.</p>;
  const x = (i: number) => PAD.left + (points.length === 1 ? 0 : (i * (W - PAD.left - PAD.right)) / (points.length - 1));
  const y = (v: number) => PAD.top + (1 - v / instrument.maxScore) * (H - PAD.top - PAD.bottom);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.total)}`).join(" ");
  const first = points[0].total;
  const last = points[points.length - 1].total;

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${instrument.id}-chart-title`}>
        <title id={`${instrument.id}-chart-title`}>
          {`${instrument.shortName} total over ${points.length} answers, from ${first} to ${last} (maximum ${instrument.maxScore}).`}
        </title>
        {instrument.bands.map((b) => (
          <g key={b.min}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(b.min)} y2={y(b.min)} className="gridline" />
            <text x={PAD.left - 6} y={y(b.min) + 4} textAnchor="end" className="axis">
              {b.min}
            </text>
          </g>
        ))}
        <path d={path} className="line" />
        {points.map((p, i) => (
          <g key={p.date}>
            <circle cx={x(i)} cy={y(p.total)} r={4} className="dot" />
            <text x={x(i)} y={H - 8} textAnchor="middle" className="axis">
              {dateFmt.format(new Date(p.date))}
            </text>
          </g>
        ))}
      </svg>
      <figcaption>
        {instrument.shortName} total score (0 to {instrument.maxScore}). Gridlines mark severity band boundaries.
      </figcaption>
    </figure>
  );
}
