'use client';

import * as d3 from 'd3';
import { useMemo, useState } from 'react';
import {
  COURT_LINES,
  COURT_VIEWBOX,
  ZONES,
  type ZoneDef,
} from '@/lib/nba/court';
import type { LeagueZoneAverage, Shot, ZoneAggregate } from '@/lib/nba/types';
import { aggregateByZone } from '@/lib/aggregate';

interface Props {
  shots: Shot[];
  leagueAverages: LeagueZoneAverage[];
  /** Optional pre-computed zones (the API route already sends these). */
  zones?: ZoneAggregate[];
}

interface Hover {
  zone: ZoneDef;
  agg: ZoneAggregate | undefined;
  x: number;
  y: number;
}

// Sequential single-hue scale: pale orange = poor FG%, deep solid orange = elite.
// Domain spans the realistic NBA shot FG% range (15% on a desperation 3 to 75%
// at the rim). The interpolator sub-range avoids near-white and near-black ends.
const FG_PCT_MIN = 0.15;
const FG_PCT_MAX = 0.75;

function colorForPct(fgPct: number): string {
  const t = Math.max(
    0,
    Math.min(1, (fgPct - FG_PCT_MIN) / (FG_PCT_MAX - FG_PCT_MIN)),
  );
  return d3.interpolateOranges(0.1 + t * 0.85);
}

const fmtPct = (n: number | null | undefined) =>
  n === null || n === undefined || Number.isNaN(n)
    ? '—'
    : `${(n * 100).toFixed(1)}%`;

const fmtSigned = (n: number) =>
  `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}pp`;

export default function ShotChart({ shots, leagueAverages, zones }: Props) {
  const [hover, setHover] = useState<Hover | null>(null);

  const aggregates = useMemo(
    () => zones ?? aggregateByZone(shots, leagueAverages),
    [zones, shots, leagueAverages],
  );

  const aggMap = useMemo(() => {
    const m = new Map<string, ZoneAggregate>();
    for (const a of aggregates) m.set(`${a.zoneBasic}|${a.zoneArea}`, a);
    return m;
  }, [aggregates]);

  function colorFor(agg: ZoneAggregate | undefined): string {
    if (!agg || agg.fga === 0) return 'rgba(255,255,255,0.04)';
    return colorForPct(agg.fgPct);
  }

  return (
    <div className="relative w-full">
      <svg
        viewBox={COURT_VIEWBOX}
        className="block h-auto w-full"
        style={{ background: '#0e1422', borderRadius: 12 }}
        onMouseLeave={() => setHover(null)}
      >
        <g className="zones">
          {ZONES.map((z) => {
            const agg = aggMap.get(`${z.basic}|${z.area}`);
            return (
              <path
                key={z.id}
                d={z.d}
                fill={colorFor(agg)}
                fillRule={z.fillRule ?? 'nonzero'}
                stroke="none"
                shapeRendering="crispEdges"
                onMouseMove={(e) => {
                  const svg = e.currentTarget.ownerSVGElement as SVGSVGElement;
                  const rect = svg.getBoundingClientRect();
                  setHover({
                    zone: z,
                    agg,
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                  });
                }}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}
        </g>

        <g
          className="court-lines"
          fill="none"
          stroke="#cbd5e1"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        >
          {COURT_LINES.map((line) => (
            <path
              key={line.key}
              d={line.d}
              strokeDasharray={
                line.key === 'ft-circle-bottom' ? '6 6' : undefined
              }
            />
          ))}
        </g>

        <g
          className="labels"
          pointerEvents="none"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
        >
          {ZONES.map((z) => {
            const agg = aggMap.get(`${z.basic}|${z.area}`);
            const fga = agg?.fga ?? 0;
            const fgPct = agg && agg.fga > 0 ? agg.fgPct : null;
            return (
              <g
                key={`label-${z.id}`}
                transform={`translate(${z.textPos.x}, ${z.textPos.y})`}
              >
                <text
                  x={0}
                  y={0}
                  textAnchor="middle"
                  fontSize={14}
                  fontWeight={700}
                  fill="#0b0f17"
                  stroke="rgba(255,255,255,0.6)"
                  strokeWidth={0.3}
                  paintOrder="stroke"
                >
                  {fga > 0 ? `${agg!.fgm}/${agg!.fga}` : '—'}
                </text>
                <text
                  x={0}
                  y={16}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={600}
                  fill="#0b0f17"
                  stroke="rgba(255,255,255,0.6)"
                  strokeWidth={0.3}
                  paintOrder="stroke"
                >
                  {fmtPct(fgPct)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-white/10 bg-slate-900/95 px-3 py-2 text-xs shadow-xl"
          style={{ left: hover.x + 14, top: hover.y + 14 }}
        >
          <div className="font-semibold text-white">{hover.zone.label}</div>
          {hover.agg && hover.agg.fga > 0 ? (
            <div className="mt-1 space-y-0.5 text-slate-200">
              <div>
                {hover.agg.fgm} / {hover.agg.fga} ·{' '}
                <span className="font-semibold">
                  {fmtPct(hover.agg.fgPct)}
                </span>
              </div>
              <div className="text-slate-400">
                League: {fmtPct(hover.agg.leagueFgPct)}
                {hover.agg.fgPctDelta !== null && (
                  <span
                    className={
                      hover.agg.fgPctDelta >= 0
                        ? 'ml-2 text-emerald-400'
                        : 'ml-2 text-rose-400'
                    }
                  >
                    {fmtSigned(hover.agg.fgPctDelta)}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-1 text-slate-400">No attempts</div>
          )}
        </div>
      )}

      <Legend />
    </div>
  );
}

function Legend() {
  const stops = d3.range(0, 1.001, 0.05).map((t) => ({
    t,
    color: colorForPct(FG_PCT_MIN + t * (FG_PCT_MAX - FG_PCT_MIN)),
  }));
  const gradId = 'legend-grad';
  return (
    <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
      <span>FG%</span>
      <span>{`${(FG_PCT_MIN * 100).toFixed(0)}%`}</span>
      <svg viewBox="0 0 200 14" className="h-3 w-48">
        <defs>
          <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
            {stops.map((s) => (
              <stop
                key={s.t}
                offset={`${s.t * 100}%`}
                stopColor={s.color}
              />
            ))}
          </linearGradient>
        </defs>
        <rect
          x={0}
          y={0}
          width={200}
          height={14}
          fill={`url(#${gradId})`}
          rx={3}
          ry={3}
        />
      </svg>
      <span>{`${(FG_PCT_MAX * 100).toFixed(0)}%`}</span>
    </div>
  );
}
