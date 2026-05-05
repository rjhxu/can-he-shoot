'use client';

import * as d3 from 'd3';
import { useId, useMemo, useState } from 'react';
import {
  COURT_LINES,
  COURT_VIEWBOX,
  ZONES,
  type ZoneDef,
} from '@/lib/nba/court';
import type { LeagueZoneAverage, Shot, ZoneAggregate } from '@/lib/nba/types';
import { aggregateByZone } from '@/lib/aggregate';
import { fmtPct, fmtSignedPp } from '@/lib/formatShot';

/** Symmetric domain for FG% delta (player − league), in percentage points as decimal. */
const FG_DELTA_DOMAIN = 0.18;

export interface ZoneHoverPayload {
  zone: ZoneDef;
  agg: ZoneAggregate | undefined;
}

interface Props {
  shots: Shot[];
  leagueAverages: LeagueZoneAverage[];
  /** Optional pre-computed zones (the API route already sends these). */
  zones?: ZoneAggregate[];
  hoveredZoneId?: string | null;
  onZoneHover?: (payload: ZoneHoverPayload | null) => void;
}

interface TooltipHover {
  zone: ZoneDef;
  agg: ZoneAggregate | undefined;
  /** Viewport coords so the tooltip stacks above sibling columns (e.g. sidebar). */
  vx: number;
  vy: number;
}

/** Red (below league) → yellow (neutral) → green (above league). */
function colorForDelta(delta: number): string {
  const t = Math.max(
    0,
    Math.min(1, (delta + FG_DELTA_DOMAIN) / (2 * FG_DELTA_DOMAIN)),
  );
  return d3.interpolateRdYlGn(t);
}

function zoneFillColors(agg: ZoneAggregate | undefined): {
  inner: string;
  outer: string;
} {
  if (!agg || agg.fga === 0) {
    const m = 'rgba(255,255,255,0.06)';
    return { inner: m, outer: 'rgba(255,255,255,0.02)' };
  }
  if (agg.leagueFgPct === null || agg.fgPctDelta === null) {
    const m = 'rgba(148,163,184,0.22)';
    return { inner: m, outer: 'rgba(148,163,184,0.06)' };
  }
  const inner = colorForDelta(agg.fgPctDelta);
  const rgb = d3.rgb(inner);
  const outer = `rgba(${rgb.r},${rgb.g},${rgb.b},0.28)`;
  return { inner, outer };
}

const HOVER_STROKE = '#22d3ee';

export default function ShotChart({
  shots,
  leagueAverages,
  zones,
  hoveredZoneId,
  onZoneHover,
}: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [tooltip, setTooltip] = useState<TooltipHover | null>(null);

  const aggregates = useMemo(
    () => zones ?? aggregateByZone(shots, leagueAverages),
    [zones, shots, leagueAverages],
  );

  const aggMap = useMemo(() => {
    const m = new Map<string, ZoneAggregate>();
    for (const a of aggregates) m.set(`${a.zoneBasic}|${a.zoneArea}`, a);
    return m;
  }, [aggregates]);

  const radialR = 130;

  return (
    <div className="relative w-full">
      <svg
        viewBox={COURT_VIEWBOX}
        className="block h-auto w-full"
        style={{ background: '#0e1422', borderRadius: 12 }}
        onMouseLeave={() => {
          setTooltip(null);
          onZoneHover?.(null);
        }}
      >
        <defs>
          {ZONES.map((z) => {
            const agg = aggMap.get(`${z.basic}|${z.area}`);
            const { inner, outer } = zoneFillColors(agg);
            const gid = `${uid}-fill-${z.id}`;
            return (
              <radialGradient
                key={gid}
                id={gid}
                gradientUnits="userSpaceOnUse"
                cx={z.textPos.x}
                cy={z.textPos.y}
                r={radialR}
              >
                <stop offset="0%" stopColor={inner} />
                <stop offset="100%" stopColor={outer} />
              </radialGradient>
            );
          })}
        </defs>

        <g className="zones">
          {ZONES.map((z) => {
            const agg = aggMap.get(`${z.basic}|${z.area}`);
            const gid = `${uid}-fill-${z.id}`;
            const isHovered = hoveredZoneId === z.id;
            return (
              <path
                key={z.id}
                d={z.d}
                fill={`url(#${gid})`}
                fillRule={z.fillRule ?? 'nonzero'}
                stroke={isHovered ? HOVER_STROKE : 'none'}
                strokeWidth={isHovered ? 2.5 : 0}
                shapeRendering="geometricPrecision"
                onMouseEnter={(e) => {
                  onZoneHover?.({ zone: z, agg });
                  setTooltip({
                    zone: z,
                    agg,
                    vx: e.clientX,
                    vy: e.clientY,
                  });
                }}
                onMouseMove={(e) => {
                  setTooltip({
                    zone: z,
                    agg,
                    vx: e.clientX,
                    vy: e.clientY,
                  });
                }}
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

        <g className="labels pointer-events-none">
          {ZONES.map((z) => {
            const agg = aggMap.get(`${z.basic}|${z.area}`);
            const fga = agg?.fga ?? 0;
            const fgPct = agg && agg.fga > 0 ? agg.fgPct : null;
            return (
              <g key={`label-${z.id}`} transform={`translate(${z.textPos.x}, ${z.textPos.y})`}>
                {/* Wide viewport avoids clipping; centered flex lays out a shrink-to-fit pill */}
                <foreignObject
                  x={-132}
                  y={-52}
                  width={264}
                  height={104}
                  overflow="visible"
                  pointerEvents="none"
                >
                  <div
                    xmlns="http://www.w3.org/1999/xhtml"
                    className="flex h-full w-full items-center justify-center font-sans"
                  >
                    <div
                      className="rounded-md px-2 py-[3px] shadow-[0_1px_2px_rgba(0,0,0,0.75)] backdrop-blur-[1px]"
                      style={{ background: 'rgba(0,0,0,0.48)', width: 'fit-content', maxWidth: '100%' }}
                    >
                      <div className="whitespace-nowrap text-center tabular-nums">
                        <div className="text-[11px] font-bold leading-tight tracking-tight text-slate-50">
                          {fga > 0 ? `${agg!.fgm}/${agg!.fga}` : '—'}
                        </div>
                        <div className="mt-px text-[10px] font-semibold leading-tight tracking-tight text-slate-200">
                          {fmtPct(fgPct)}
                        </div>
                      </div>
                    </div>
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </g>
      </svg>

      {tooltip && (
        <div
          className="pointer-events-none fixed z-[100] rounded-md border border-white/10 bg-slate-900/95 px-3 py-2 text-xs shadow-xl backdrop-blur-sm"
          style={{ left: tooltip.vx + 14, top: tooltip.vy + 14 }}
        >
          <div className="font-semibold text-white">{tooltip.zone.label}</div>
          {tooltip.agg && tooltip.agg.fga > 0 ? (
            <div className="mt-1 space-y-0.5 text-slate-200">
              <div>
                {tooltip.agg.fgm} / {tooltip.agg.fga} ·{' '}
                <span className="font-semibold">
                  {fmtPct(tooltip.agg.fgPct)}
                </span>
              </div>
              <div className="text-slate-400">
                League: {fmtPct(tooltip.agg.leagueFgPct)}
                {tooltip.agg.fgPctDelta !== null && (
                  <span
                    className={
                      tooltip.agg.fgPctDelta >= 0
                        ? 'ml-2 text-emerald-400'
                        : 'ml-2 text-rose-400'
                    }
                  >
                    {fmtSignedPp(tooltip.agg.fgPctDelta)}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-1 text-slate-400">No attempts</div>
          )}
        </div>
      )}

      <Legend uid={uid} />
    </div>
  );
}

function Legend({ uid }: { uid: string }) {
  const gradId = `${uid}-legend-grad`;
  const stops = d3.range(0, 1.001, 0.04).map((t) => ({
    t,
    color: colorForDelta(-FG_DELTA_DOMAIN + t * 2 * FG_DELTA_DOMAIN),
  }));
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
      <span className="shrink-0">vs league</span>
      <span className="shrink-0 text-rose-300/90">Below</span>
      <svg viewBox="0 0 200 14" className="h-3 w-48 shrink-0">
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
      <span className="shrink-0 text-emerald-300/90">Above</span>
      <span className="ml-1 shrink-0 text-slate-500">
        (±{(FG_DELTA_DOMAIN * 100).toFixed(0)}pp)
      </span>
    </div>
  );
}
