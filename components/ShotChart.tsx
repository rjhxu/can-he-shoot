'use client';

import * as d3 from 'd3';
import { useTheme } from 'next-themes';
import { useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  COURT,
  COURT_LINES,
  COURT_VIEWBOX,
  ZONES,
  type ZoneDef,
  toSvg,
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

export type ShotChartMode = 'heatmap' | 'shotchart';
export type ShotResultFilter = 'makes' | 'misses';

interface Props {
  shots: Shot[];
  leagueAverages: LeagueZoneAverage[];
  /** Optional pre-computed zones (the API route already sends these). */
  zones?: ZoneAggregate[];
  mode?: ShotChartMode;
  shotResultFilter?: ShotResultFilter;
  onShotResultFilterChange?: (filter: ShotResultFilter) => void;
  hoveredZoneId?: string | null;
  onZoneHover?: (payload: ZoneHoverPayload | null) => void;
  onZoneSelect?: (payload: ZoneHoverPayload | null) => void;
}

interface ZoneTooltipHover {
  zone: ZoneDef;
  agg: ZoneAggregate | undefined;
  /** Viewport coords so the tooltip stacks above sibling columns (e.g. sidebar). */
  vx: number;
  vy: number;
}

interface HexBin {
  q: number;
  r: number;
  x: number;
  y: number;
  total: number;
  makes: number;
  misses: number;
}

interface HexTooltipHover {
  bin: HexBin;
  filter: ShotResultFilter;
  vx: number;
  vy: number;
}

/**
 * Theme-aware chart palette. Light mode uses deeper, print-like colors on a
 * warm paper court; dark mode keeps the vivid scale that reads well on navy.
 */
interface ChartTheme {
  courtBg: string;
  courtLine: string;
  hoverStroke: string;
  deltaBelow: string;
  deltaMid: string;
  deltaAbove: string;
  makesStart: string;
  makesEnd: string;
  missesStart: string;
  missesEnd: string;
  emptyFill: string;
  noLeagueFill: string;
  hexStroke: string;
}

const CHART_THEMES: Record<'light' | 'dark', ChartTheme> = {
  light: {
    courtBg: '#efece7',
    courtLine: '#a8a49b',
    hoverStroke: '#191a1e',
    deltaBelow: '#d92d47',
    deltaMid: '#cbc6bc',
    deltaAbove: '#0f9d58',
    makesStart: '#9ed3b2',
    makesEnd: '#085c30',
    missesStart: '#f0b4a8',
    missesEnd: '#c01f39',
    emptyFill: 'rgba(25,26,30,0.03)',
    noLeagueFill: 'rgba(25,26,30,0.10)',
    hexStroke: 'rgba(25,26,30,0.18)',
  },
  dark: {
    courtBg: '#0e1219',
    courtLine: '#5b6474',
    hoverStroke: '#ffffff',
    deltaBelow: '#ff1f4b',
    deltaMid: '#334155',
    deltaAbove: '#00ff66',
    makesStart: '#166534',
    makesEnd: '#00ff66',
    missesStart: '#334155',
    missesEnd: '#ff1f4b',
    emptyFill: 'rgba(255,255,255,0.05)',
    noLeagueFill: 'rgba(148,163,184,0.22)',
    hexStroke: 'rgba(15,23,42,0.55)',
  },
};

function colorForDelta(delta: number, theme: ChartTheme): string {
  const t = Math.max(
    0,
    Math.min(1, (delta + FG_DELTA_DOMAIN) / (2 * FG_DELTA_DOMAIN)),
  );
  if (t <= 0.5) {
    return d3.interpolateRgb(theme.deltaBelow, theme.deltaMid)(t / 0.5);
  }
  return d3.interpolateRgb(theme.deltaMid, theme.deltaAbove)((t - 0.5) / 0.5);
}

function zoneFillColor(agg: ZoneAggregate | undefined, theme: ChartTheme): string {
  if (!agg || agg.fga === 0) {
    return theme.emptyFill;
  }
  if (agg.leagueFgPct === null || agg.fgPctDelta === null) {
    return theme.noLeagueFill;
  }
  return colorForDelta(agg.fgPctDelta, theme);
}

const HEX_RADIUS = 8;
const SQRT_3 = Math.sqrt(3);

export default function ShotChart({
  shots,
  leagueAverages,
  zones,
  mode = 'heatmap',
  shotResultFilter = 'makes',
  onShotResultFilterChange,
  hoveredZoneId,
  onZoneHover,
  onZoneSelect,
}: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const { resolvedTheme } = useTheme();
  const chartTheme = CHART_THEMES[resolvedTheme === 'light' ? 'light' : 'dark'];
  const [zoneTooltip, setZoneTooltip] = useState<ZoneTooltipHover | null>(null);
  const [hexTooltip, setHexTooltip] = useState<HexTooltipHover | null>(null);

  const aggregates = useMemo(
    () => zones ?? aggregateByZone(shots, leagueAverages),
    [zones, shots, leagueAverages],
  );

  const aggMap = useMemo(() => {
    const m = new Map<string, ZoneAggregate>();
    for (const a of aggregates) m.set(`${a.zoneBasic}|${a.zoneArea}`, a);
    return m;
  }, [aggregates]);

  const hexBins = useMemo(
    () => buildHexBins(shots, shotResultFilter, HEX_RADIUS),
    [shots, shotResultFilter],
  );

  const maxBinValue = useMemo(
    () =>
      hexBins.reduce((max, bin) => {
        const value = shotResultFilter === 'makes' ? bin.makes : bin.misses;
        return Math.max(max, value);
      }, 0),
    [hexBins, shotResultFilter],
  );

  return (
    <div className="relative w-full">
      <svg
        viewBox={COURT_VIEWBOX}
        className="block h-auto w-full"
        style={{ background: chartTheme.courtBg, borderRadius: 12 }}
        onMouseLeave={() => {
          setZoneTooltip(null);
          setHexTooltip(null);
          onZoneHover?.(null);
        }}
      >
        {mode === 'heatmap' ? (
          <g className="zones">
            {ZONES.map((z) => {
              const agg = aggMap.get(`${z.basic}|${z.area}`);
              const isHovered = hoveredZoneId === z.id;
              return (
                <path
                  key={z.id}
                  d={z.d}
                  fill={zoneFillColor(agg, chartTheme)}
                  fillRule={z.fillRule ?? 'nonzero'}
                  stroke={isHovered ? chartTheme.hoverStroke : 'none'}
                  strokeWidth={isHovered ? 2.5 : 0}
                  shapeRendering="geometricPrecision"
                  onMouseEnter={(e) => {
                    onZoneHover?.({ zone: z, agg });
                    setZoneTooltip({
                      zone: z,
                      agg,
                      vx: e.clientX,
                      vy: e.clientY,
                    });
                  }}
                  onMouseMove={(e) => {
                    setZoneTooltip({
                      zone: z,
                      agg,
                      vx: e.clientX,
                      vy: e.clientY,
                    });
                  }}
                  onClick={() => {
                    onZoneSelect?.({ zone: z, agg });
                  }}
                />
              );
            })}
          </g>
        ) : (
          <g className="hexes">
            {hexBins.map((bin) => {
              const value = shotResultFilter === 'makes' ? bin.makes : bin.misses;
              return (
                <path
                  key={`${bin.q},${bin.r}`}
                  d={hexPath(bin.x, bin.y, HEX_RADIUS)}
                  fill={hexFillColor(value, maxBinValue, shotResultFilter, chartTheme)}
                  stroke={chartTheme.hexStroke}
                  strokeWidth={0.7}
                  shapeRendering="geometricPrecision"
                  onMouseEnter={(e) => {
                    onZoneHover?.(null);
                    onZoneSelect?.(null);
                    setHexTooltip({
                      bin,
                      filter: shotResultFilter,
                      vx: e.clientX,
                      vy: e.clientY,
                    });
                  }}
                  onMouseMove={(e) => {
                    setHexTooltip({
                      bin,
                      filter: shotResultFilter,
                      vx: e.clientX,
                      vy: e.clientY,
                    });
                  }}
                />
              );
            })}
          </g>
        )}

        <g
          className="court-lines"
          fill="none"
          stroke={chartTheme.courtLine}
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

        {mode === 'heatmap' && (
          <g className="labels pointer-events-none">
            {ZONES.map((z) => {
              const agg = aggMap.get(`${z.basic}|${z.area}`);
              const fga = agg?.fga ?? 0;
              const fgPct = agg && agg.fga > 0 ? agg.fgPct : null;
              return (
                <g
                  key={`label-${z.id}`}
                  transform={`translate(${z.textPos.x}, ${z.textPos.y})`}
                >
                  <foreignObject
                    x={-132}
                    y={-52}
                    width={264}
                    height={104}
                    overflow="visible"
                    pointerEvents="none"
                  >
                    <div className="flex h-full w-full items-center justify-center font-sans">
                      <div
                        className="rounded-md px-2 py-[3px] backdrop-blur-[1px]"
                        style={{
                          background:
                            resolvedTheme === 'light'
                              ? 'rgba(255,255,255,0.82)'
                              : 'rgba(0,0,0,0.48)',
                          boxShadow:
                            resolvedTheme === 'light'
                              ? '0 1px 2px rgba(25,26,30,0.28)'
                              : '0 1px 2px rgba(0,0,0,0.75)',
                          width: 'fit-content',
                          maxWidth: '100%',
                        }}
                      >
                        <div className="whitespace-nowrap text-center tabular-nums">
                          <div
                            className="text-[11px] font-bold leading-tight tracking-tight"
                            style={{
                              color: resolvedTheme === 'light' ? '#191a1e' : '#f8fafc',
                            }}
                          >
                            {fga > 0 ? `${agg!.fgm}/${agg!.fga}` : '—'}
                          </div>
                          <div
                            className="mt-px text-[10px] font-semibold leading-tight tracking-tight"
                            style={{
                              color: resolvedTheme === 'light' ? '#5f646e' : '#e2e8f0',
                            }}
                          >
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
        )}
      </svg>

      {zoneTooltip &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[9999] rounded-xl border border-line bg-card px-3 py-2 text-xs shadow-xl"
            style={{ left: zoneTooltip.vx + 14, top: zoneTooltip.vy + 14 }}
          >
            <div className="font-semibold text-ink">{zoneTooltip.zone.label}</div>
            {zoneTooltip.agg && zoneTooltip.agg.fga > 0 ? (
              <div className="mt-1 space-y-0.5 text-ink">
                <div>
                  {zoneTooltip.agg.fgm} / {zoneTooltip.agg.fga} ·{' '}
                  <span className="font-semibold">
                    {fmtPct(zoneTooltip.agg.fgPct)}
                  </span>
                </div>
                <div className="text-ink-muted">
                  League: {fmtPct(zoneTooltip.agg.leagueFgPct)}
                  {zoneTooltip.agg.fgPctDelta !== null && (
                    <span
                      className={
                        zoneTooltip.agg.fgPctDelta >= 0
                          ? 'ml-2 text-emerald-600 dark:text-emerald-400'
                          : 'ml-2 text-rose-600 dark:text-rose-400'
                      }
                    >
                      {fmtSignedPp(zoneTooltip.agg.fgPctDelta)}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-1 text-ink-muted">No attempts</div>
            )}
          </div>,
          document.body,
        )}

      {hexTooltip &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[9999] rounded-xl border border-line bg-card px-3 py-2 text-xs shadow-xl"
            style={{ left: hexTooltip.vx + 14, top: hexTooltip.vy + 14 }}
          >
            <div className="font-semibold text-ink">
              {hexTooltip.filter === 'makes' ? 'Made shots' : 'Missed shots'}
            </div>
            <div className="mt-1 text-ink">
              {hexTooltip.filter === 'makes'
                ? `${hexTooltip.bin.makes} makes`
                : `${hexTooltip.bin.misses} misses`}
            </div>
            <div className="text-ink-faint">{hexTooltip.bin.total} total attempts</div>
          </div>,
          document.body,
        )}

      {mode === 'heatmap' ? (
        <Legend uid={uid} chartTheme={chartTheme} />
      ) : (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <HexLegend uid={uid} filter={shotResultFilter} chartTheme={chartTheme} />
          <ShotResultToggle
            value={shotResultFilter}
            onChange={onShotResultFilterChange}
          />
        </div>
      )}
    </div>
  );
}

function Legend({ uid, chartTheme }: { uid: string; chartTheme: ChartTheme }) {
  const gradId = `${uid}-legend-grad`;
  const stops = d3.range(0, 1.001, 0.04).map((t) => ({
    t,
    color: colorForDelta(-FG_DELTA_DOMAIN + t * 2 * FG_DELTA_DOMAIN, chartTheme),
  }));
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
      <span className="shrink-0">vs league</span>
      <span className="shrink-0 text-rose-600/90 dark:text-rose-300/90">Below</span>
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
      <span className="shrink-0 text-emerald-600/90 dark:text-emerald-300/90">Above</span>
      <span className="ml-1 shrink-0 text-ink-faint">
        (±{(FG_DELTA_DOMAIN * 100).toFixed(0)}pp)
      </span>
    </div>
  );
}

function HexLegend({
  uid,
  filter,
  chartTheme,
}: {
  uid: string;
  filter: ShotResultFilter;
  chartTheme: ChartTheme;
}) {
  const gradId = `${uid}-hex-legend-grad`;
  const start = filter === 'makes' ? chartTheme.makesStart : chartTheme.missesStart;
  const end = filter === 'makes' ? chartTheme.makesEnd : chartTheme.missesEnd;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
      <span className="shrink-0">
        {filter === 'makes' ? 'made shots per hex' : 'missed shots per hex'}
      </span>
      <span className="shrink-0 text-ink-faint">Low</span>
      <svg viewBox="0 0 200 14" className="h-3 w-48 shrink-0">
        <defs>
          <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor={start} />
            <stop offset="100%" stopColor={end} />
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
      <span
        className={`shrink-0 ${
          filter === 'makes'
            ? 'text-emerald-600/90 dark:text-emerald-300/90'
            : 'text-rose-600/90 dark:text-rose-300/90'
        }`}
      >
        High
      </span>
    </div>
  );
}

function ShotResultToggle({
  value,
  onChange,
}: {
  value: ShotResultFilter;
  onChange?: (filter: ShotResultFilter) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-line bg-panel p-1 text-xs sm:text-sm">
      <ToggleButton
        active={value === 'makes'}
        label="Makes"
        onClick={() => onChange?.('makes')}
      />
      <ToggleButton
        active={value === 'misses'}
        label="Misses"
        onClick={() => onChange?.('misses')}
      />
    </div>
  );
}

function ToggleButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 transition ${
        active
          ? 'bg-ink font-medium text-paper shadow-sm'
          : 'text-ink-muted hover:text-ink'
      }`}
    >
      {label}
    </button>
  );
}

function hexFillColor(
  value: number,
  maxValue: number,
  filter: ShotResultFilter,
  theme: ChartTheme,
): string {
  if (value <= 0 || maxValue <= 0) {
    return theme.emptyFill;
  }
  const t = Math.min(1, value / maxValue);
  return filter === 'makes'
    ? d3.interpolateRgb(theme.makesStart, theme.makesEnd)(t)
    : d3.interpolateRgb(theme.missesStart, theme.missesEnd)(t);
}

function hexPath(cx: number, cy: number, radius: number): string {
  const points: [number, number][] = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  return `M ${points.map(([x, y]) => `${x},${y}`).join(' L ')} Z`;
}

function buildHexBins(
  shots: Shot[],
  filter: ShotResultFilter,
  radius: number,
): HexBin[] {
  const bins = new Map<string, HexBin>();
  for (const shot of shots) {
    if (filter === 'makes' && !shot.made) continue;
    if (filter === 'misses' && shot.made) continue;

    const [x, y] = toSvg(shot.locX, shot.locY);
    if (
      x < -COURT.sidelineX ||
      x > COURT.sidelineX ||
      y < COURT.halfCourtY ||
      y > COURT.baselineY
    ) {
      continue;
    }

    const axial = pointToAxial(x, y, radius);
    const key = `${axial.q},${axial.r}`;
    const center = axialToPoint(axial.q, axial.r, radius);
    const existing = bins.get(key);
    if (existing) {
      existing.total += 1;
      if (shot.made) existing.makes += 1;
      else existing.misses += 1;
      continue;
    }
    bins.set(key, {
      q: axial.q,
      r: axial.r,
      x: center.x,
      y: center.y,
      total: 1,
      makes: shot.made ? 1 : 0,
      misses: shot.made ? 0 : 1,
    });
  }
  return Array.from(bins.values());
}

function pointToAxial(x: number, y: number, size: number): { q: number; r: number } {
  const q = (SQRT_3 / 3 * x - (1 / 3) * y) / size;
  const r = ((2 / 3) * y) / size;
  return roundAxial(q, r);
}

function axialToPoint(q: number, r: number, size: number): { x: number; y: number } {
  return {
    x: size * SQRT_3 * (q + r / 2),
    y: size * 1.5 * r,
  };
}

function roundAxial(q: number, r: number): { q: number; r: number } {
  let x = q;
  let z = r;
  let y = -x - z;

  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);

  const xDiff = Math.abs(rx - x);
  const yDiff = Math.abs(ry - y);
  const zDiff = Math.abs(rz - z);

  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  x = rx;
  z = rz;
  return { q: x, r: z };
}
