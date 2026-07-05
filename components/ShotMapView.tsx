'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import PlayerSearch from './PlayerSearch';
import SeasonTypeToggle from './SeasonTypeToggle';
import ShotChart, {
  type ShotChartMode,
  type ShotResultFilter,
  type ZoneHoverPayload,
} from './ShotChart';
import { computeTotals, type ShootingTotals } from '@/lib/aggregate';
import { fmtPct, fmtSignedPp } from '@/lib/formatShot';
import {
  fmtMakesAttempts,
  fmtMinutes,
  fmtPerGame,
  fmtPlusMinus,
} from '@/lib/formatPlayerStats';
import {
  COURT_LINES,
  COURT_VIEWBOX,
  ZONES,
} from '@/lib/nba/court';
import { teamGlowColors } from '@/lib/teamColors';
import {
  unusualVsLeagueLine,
  zoneVsLeagueTier,
} from '@/lib/zoneComparison';
import {
  EMPTY_STATS_BY_SEASON_TYPE,
  type StatsBySeasonType,
} from '@/lib/statsSeasonTypeTabs';
import type {
  LeagueZoneAverage,
  Player,
  PlayerSeasonStats,
  SeasonType,
  Shot,
  ZoneAggregate,
} from '@/lib/nba/types';

interface Props {
  players: Player[];
  defaultPlayer?: Player;
}

interface ShotsResponse {
  playerId: number;
  season: string;
  seasonType: SeasonType;
  shots: Shot[];
  zones: ZoneAggregate[];
  totals: ShootingTotals;
  leagueAverages: LeagueZoneAverage[];
}

interface StatsResponse {
  playerId: number;
  season: string;
  seasonType: SeasonType;
  stats: PlayerSeasonStats | null;
}

export default function ShotMapView({ players, defaultPlayer }: Props) {
  const [selected, setSelected] = useState<Player | null>(defaultPlayer ?? null);
  const [seasonType, setSeasonType] = useState<SeasonType>('Regular Season');
  const [mapMode, setMapMode] = useState<ShotChartMode>('heatmap');
  const [shotResultFilter, setShotResultFilter] =
    useState<ShotResultFilter>('makes');
  const [data, setData] = useState<ShotsResponse | null>(null);
  const [statsByType, setStatsByType] = useState<StatsBySeasonType>(
    EMPTY_STATS_BY_SEASON_TYPE,
  );
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statsErrors, setStatsErrors] = useState<Partial<Record<SeasonType, string>>>(
    {},
  );
  const [hoveredZone, setHoveredZone] = useState<ZoneHoverPayload | null>(null);
  const [selectedZone, setSelectedZone] = useState<ZoneHoverPayload | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    setHoveredZone(null);
    setSelectedZone(null);
  }, [selected, seasonType]);

  useEffect(() => {
    if (!selected) {
      setData(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setHoveredZone(null);
    setSelectedZone(null);
    setError(null);
    const params = new URLSearchParams({ seasonType });
    fetch(`/api/shots/${selected.personId}?${params.toString()}`, {
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || `Request failed (${res.status})`);
        }
        return (await res.json()) as ShotsResponse;
      })
      .then((d) => setData(d))
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load shots');
        setData(null);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [selected, seasonType]);

  useEffect(() => {
    setSeasonType('Regular Season');
  }, [selected]);

  useEffect(() => {
    if (!selected) {
      setStatsByType(EMPTY_STATS_BY_SEASON_TYPE);
      setStatsErrors({});
      return;
    }
    const ctrl = new AbortController();
    setStatsLoading(true);
    setStatsErrors({});
    setStatsByType(EMPTY_STATS_BY_SEASON_TYPE);

    const seasonTypes: SeasonType[] = ['Regular Season', 'Playoffs'];
    Promise.all(
      seasonTypes.map(async (st) => {
        try {
          const params = new URLSearchParams({ seasonType: st });
          const res = await fetch(
            `/api/stats/${selected.personId}?${params.toString()}`,
            { signal: ctrl.signal },
          );
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(body.error || `Request failed (${res.status})`);
          }
          const payload = (await res.json()) as StatsResponse;
          return { seasonType: st, stats: payload.stats, error: null as string | null };
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            return null;
          }
          return {
            seasonType: st,
            stats: null,
            error: err instanceof Error ? err.message : 'Failed to load stats',
          };
        }
      }),
    )
      .then((results) => {
        if (ctrl.signal.aborted) return;
        if (results.some((r) => r === null)) return;

        const next: StatsBySeasonType = { ...EMPTY_STATS_BY_SEASON_TYPE };
        const errors: Partial<Record<SeasonType, string>> = {};
        for (const result of results) {
          if (!result) continue;
          next[result.seasonType] = result.stats;
          if (result.error) errors[result.seasonType] = result.error;
        }
        setStatsByType(next);
        setStatsErrors(errors);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setStatsLoading(false);
      });

    return () => ctrl.abort();
  }, [selected]);

  const totals = data?.totals ?? (data ? computeTotals(data.shots) : null);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <header className="flex flex-row flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex-1">
          <PlayerSearch
            players={players}
            selected={selected}
            onSelect={setSelected}
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          <MapModeToggle value={mapMode} onChange={setMapMode} />
          <SeasonTypeToggle value={seasonType} onChange={setSeasonType} />
        </div>
      </header>

      <section className="grid items-start gap-4 lg:gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-line bg-card p-2 shadow-sm sm:p-3">
          {!selected ? (
            <EmptyState />
          ) : loading ? (
            <LoadingState player={selected} />
          ) : error ? (
            <ErrorState message={error} />
          ) : data && data.shots.length === 0 ? (
            <NoShotsState player={selected} seasonType={seasonType} />
          ) : data ? (
            <ShotChart
              shots={data.shots}
              leagueAverages={data.leagueAverages}
              zones={data.zones}
              mode={mapMode}
              shotResultFilter={shotResultFilter}
              onShotResultFilterChange={setShotResultFilter}
              hoveredZoneId={
                (isMobile ? selectedZone?.zone.id : hoveredZone?.zone.id) ?? null
              }
              onZoneHover={isMobile ? undefined : setHoveredZone}
              onZoneSelect={isMobile ? setSelectedZone : undefined}
            />
          ) : null}

          {isMobile && selectedZone && mapMode === 'heatmap' && !loading && (
            <div className="mt-2">
              <ZoneDetailCard
                title="Selected zone"
                zonePayload={selectedZone}
                emptyLabel="No attempts in this zone."
              />
            </div>
          )}
        </div>

        <aside className="relative overflow-visible rounded-2xl border border-line bg-card px-3 py-3 shadow-sm sm:px-4 sm:py-4 lg:pb-4 lg:pt-[5.5rem]">
          <SidePanel
            player={selected}
            seasonType={seasonType}
            mapMode={mapMode}
            shots={data?.shots ?? []}
            totals={totals}
            statsByType={statsByType}
            statsLoading={statsLoading && !!selected}
            statsErrors={statsErrors}
            hoveredZone={hoveredZone}
            loading={loading && !!selected}
            isMobile={isMobile}
          />
        </aside>
      </section>
    </div>
  );
}

function SidePanel({
  player,
  seasonType,
  mapMode,
  shots,
  totals,
  statsByType,
  statsLoading,
  statsErrors,
  hoveredZone,
  loading,
  isMobile,
}: {
  player: Player | null;
  seasonType: SeasonType;
  mapMode: ShotChartMode;
  shots: Shot[];
  totals: ShootingTotals | null;
  statsByType: StatsBySeasonType;
  statsLoading: boolean;
  statsErrors: Partial<Record<SeasonType, string>>;
  hoveredZone: ZoneHoverPayload | null;
  loading: boolean;
  isMobile: boolean;
}) {
  if (!player) {
    return (
      <div className="text-sm text-ink-muted">
        Pick a player to load their {`'25–'26`} shot map.
      </div>
    );
  }

  const glow = teamGlowColors(player.teamAbbreviation);

  return (
    <div className="space-y-4">
      {isMobile ? (
        <>
          <div>
            <div className="font-display text-xl font-bold uppercase tracking-wide text-ink">
              {player.fullName}
            </div>
            <div className="text-xs uppercase tracking-widest text-ink-muted">
              {player.teamAbbreviation || '—'} · {seasonType}
            </div>
          </div>
          <div className="grid grid-cols-[156px_1fr] items-stretch gap-1.5">
            <PlayerHeadshot
              player={player}
              glow={glow}
              isMobile={isMobile}
              matchStatsHeight
            />
            <div className="grid grid-cols-1 gap-1.5">
              <MobileStat label="Attempts" value={shots.length.toLocaleString()} />
              <MobileStat
                label="FG%"
                value={totals ? `${(totals.fgPct * 100).toFixed(1)}%` : '—'}
              />
              <MobileStat
                label="3PA"
                value={totals ? totals.fg3a.toLocaleString() : '—'}
              />
              <MobileStat
                label="3P%"
                value={totals ? `${(totals.fg3Pct * 100).toFixed(1)}%` : '—'}
              />
            </div>
          </div>
        </>
      ) : (
        <>
          <PlayerHeadshot player={player} glow={glow} isMobile={isMobile} />
          <div>
            <div className="font-display text-2xl font-bold uppercase tracking-wide text-ink">
              {player.fullName}
            </div>
            <div className="text-xs uppercase tracking-widest text-ink-muted">
              {player.teamAbbreviation || '—'} · {seasonType}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Attempts" value={shots.length.toLocaleString()} />
            <Stat
              label="FG%"
              value={totals ? `${(totals.fgPct * 100).toFixed(1)}%` : '—'}
            />
            <Stat
              label="3PA"
              value={totals ? totals.fg3a.toLocaleString() : '—'}
            />
            <Stat
              label="3P%"
              value={totals ? `${(totals.fg3Pct * 100).toFixed(1)}%` : '—'}
            />
          </div>
        </>
      )}

      <SeasonStatsPanel
        seasonType={seasonType}
        statsByType={statsByType}
        loading={statsLoading}
        errors={statsErrors}
        isMobile={isMobile}
      />

      {!isMobile && hoveredZone && !loading && (
        <ZoneDetailCard
          title="Hovered zone"
          zonePayload={hoveredZone}
          emptyLabel="No attempts in this zone."
        />
      )}
      <p className="text-xs text-ink-faint">
        {mapMode === 'heatmap'
          ? isMobile
            ? 'Colors compare each zone’s FG% to the league average for that zone (green above, red below). Tap a zone on the court to pin details below the chart.'
            : 'Colors compare each zone’s FG% to the league average for that zone (green above, red below). Hover the court to highlight a zone and see details here; the chart tooltip shows the same numbers.'
          : 'Hexes show where shots happen most often. In Makes view, stronger green means more made shots in that area; in Misses view, deeper red means more misses.'}
      </p>
    </div>
  );
}

function MapModeToggle({
  value,
  onChange,
}: {
  value: ShotChartMode;
  onChange: (mode: ShotChartMode) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-line bg-panel p-1 text-xs sm:text-sm">
      <ToggleButton
        active={value === 'heatmap'}
        label="Heatmap"
        onClick={() => onChange('heatmap')}
      />
      <ToggleButton
        active={value === 'shotchart'}
        label="Shot Chart"
        onClick={() => onChange('shotchart')}
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

function PlayerHeadshot({
  player,
  glow,
  isMobile,
  matchStatsHeight = false,
}: {
  player: Player;
  glow: { primary: string; secondary: string };
  isMobile: boolean;
  matchStatsHeight?: boolean;
}) {
  const [errored, setErrored] = useState(false);
  const initials = player.fullName
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const shell = (
    <>
      {errored ? (
        <div
          className={`relative z-10 flex w-full items-center justify-center rounded-xl bg-panel text-lg font-semibold text-ink-muted ring-1 ring-line ${
            matchStatsHeight ? 'h-full' : 'aspect-[260/190]'
          }`}
          aria-label={`${player.fullName} headshot`}
        >
          {initials || '—'}
        </div>
      ) : (
        <img
          src={`https://cdn.nba.com/headshots/nba/latest/260x190/${player.personId}.png`}
          alt={`${player.fullName} headshot`}
          loading="lazy"
          onError={() => setErrored(true)}
          className={`relative z-10 w-full rounded-xl object-cover ring-1 ring-line ${
            matchStatsHeight ? 'h-full' : 'aspect-[260/190]'
          }`}
        />
      )}
    </>
  );

  return (
    <div
      className={`relative mb-2 w-full ${isMobile ? '' : '-mt-[4.5rem]'} ${
        matchStatsHeight ? 'h-full' : ''
      }`}
    >
      <div
        className={`relative w-full rounded-xl ${matchStatsHeight ? 'h-full' : ''}`}
        style={{
          boxShadow: isMobile
            ? '0 0 0 1px rgba(255,255,255,0.08)'
            : `0 0 0 1px rgba(255,255,255,0.08), 0 18px 48px -12px ${glow.primary}aa, 0 8px 28px -8px ${glow.secondary}99`,
        }}
      >
        {shell}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  compact = false,
  dense = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
  dense?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-line bg-panel px-3 ${
        compact ? 'py-1.5' : 'py-2.5'
      }`}
    >
      <div
        className={`uppercase tracking-wider text-ink-faint ${
          dense ? 'text-[10px]' : 'text-[11px]'
        }`}
      >
        {label}
      </div>
      <div
        className={`font-semibold tabular-nums text-ink ${
          dense ? 'text-base' : compact ? 'text-lg' : 'text-xl'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function MobileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between rounded-lg border border-line bg-panel px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="text-sm font-semibold tabular-nums text-ink">{value}</div>
    </div>
  );
}

function SeasonStatsPanel({
  seasonType,
  statsByType,
  loading,
  errors,
  isMobile,
}: {
  seasonType: SeasonType;
  statsByType: StatsBySeasonType;
  loading: boolean;
  errors: Partial<Record<SeasonType, string>>;
  isMobile: boolean;
}) {
  const stats = statsByType[seasonType];
  const error = errors[seasonType] ?? null;
  const hasAnyStats =
    statsByType['Regular Season'] !== null || statsByType.Playoffs !== null;

  if (loading) {
    return (
      <div className="rounded-xl border border-line bg-panel p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
          Season stats
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-md bg-line court-skeleton-legend"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!hasAnyStats && !error) {
    return (
      <div className="rounded-xl border border-line bg-panel p-3 text-xs text-ink-muted">
        No season stats on file for this player yet.
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
          Season stats · {seasonType}
        </div>
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-500/25 dark:bg-rose-500/5 dark:text-rose-200/90">
          <div className="font-medium text-rose-800 dark:text-rose-200">
            {seasonType} stats unavailable
          </div>
          <div className="mt-0.5 text-rose-700 dark:text-rose-200/70">{error}</div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
          Season stats · {seasonType}
        </div>
        <div className="rounded-xl border border-line bg-panel p-3 text-xs text-ink-muted">
          No {seasonType.toLowerCase()} stats on file for this player yet.
        </div>
      </div>
    );
  }

  const coreStats = [
    { label: 'PTS', value: fmtPerGame(stats.pts) },
    { label: 'REB', value: fmtPerGame(stats.reb) },
    { label: 'AST', value: fmtPerGame(stats.ast) },
    { label: 'STL', value: fmtPerGame(stats.stl) },
    { label: 'BLK', value: fmtPerGame(stats.blk) },
    { label: 'TOV', value: fmtPerGame(stats.tov) },
  ];

  const shootingLines = [
    {
      label: 'FG',
      pct: fmtPct(stats.fgPct),
      line: fmtMakesAttempts(stats.fgm, stats.fga),
    },
    {
      label: '3PT',
      pct: fmtPct(stats.fg3Pct),
      line: fmtMakesAttempts(stats.fg3m, stats.fg3a),
    },
    {
      label: 'FT',
      pct: fmtPct(stats.ftPct),
      line: fmtMakesAttempts(stats.ftm, stats.fta),
    },
  ];

  return (
    <div className="rounded-xl border border-line bg-panel p-3">
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
          Season stats
        </div>
        <div className="text-[10px] text-ink-faint">
          {seasonType} · per game
        </div>
      </div>

      <div
        className={`mt-2 grid gap-2 ${isMobile ? 'grid-cols-3' : 'grid-cols-3'}`}
      >
        {coreStats.map(({ label, value }) => (
          <Stat key={label} label={label} value={value} compact dense />
        ))}
      </div>

      <div className="mt-2 space-y-1.5 border-t border-line pt-2 text-sm">
        {shootingLines.map(({ label, pct, line }) => (
          <div key={label} className="flex items-baseline justify-between gap-2">
            <div className="text-[11px] uppercase tracking-wider text-ink-faint">
              {label}
            </div>
            <div className="tabular-nums text-ink">
              <span className="font-semibold">{pct}</span>
              <span className="text-ink-faint"> · </span>
              <span className="text-ink-muted">{line}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 border-t border-line pt-2 text-[11px] text-ink-faint">
        <span>
          GP <span className="font-medium text-ink">{stats.gp}</span>
        </span>
        <span>
          MIN <span className="font-medium text-ink">{fmtMinutes(stats.min)}</span>
        </span>
        <span>
          +/−{' '}
          <span
            className={`font-medium ${
              stats.plusMinus === null
                ? 'text-ink'
                : stats.plusMinus > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : stats.plusMinus < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-ink'
            }`}
          >
            {fmtPlusMinus(stats.plusMinus)}
          </span>
        </span>
      </div>
    </div>
  );
}

function ZoneDetailCard({
  title,
  zonePayload,
  emptyLabel,
}: {
  title: string;
  zonePayload: ZoneHoverPayload;
  emptyLabel: string;
}) {
  return (
    <div className="rounded-xl border border-accent/40 bg-panel p-3 text-sm shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-accent">
        {title}
      </div>
      <div className="mt-0.5 font-medium text-ink">{zonePayload.zone.label}</div>
      {zonePayload.agg && zonePayload.agg.fga > 0 ? (
        <div className="mt-2 space-y-1.5 text-ink">
          <div>
            <span className="text-ink-muted">FGM/FGA </span>
            <span className="font-semibold text-ink">
              {zonePayload.agg.fgm} / {zonePayload.agg.fga}
            </span>
          </div>
          <div>
            <span className="text-ink-muted">FG% </span>
            <span className="font-semibold text-ink">
              {fmtPct(zonePayload.agg.fgPct)}
            </span>
            <span className="text-ink-muted"> · league </span>
            <span>{fmtPct(zonePayload.agg.leagueFgPct)}</span>
            {zonePayload.agg.fgPctDelta !== null && (
              <span
                className={
                  zonePayload.agg.fgPctDelta >= 0
                    ? ' ml-1 font-medium text-emerald-600 dark:text-emerald-400'
                    : ' ml-1 font-medium text-rose-600 dark:text-rose-400'
                }
              >
                ({fmtSignedPp(zonePayload.agg.fgPctDelta)})
              </span>
            )}
          </div>
          <p className="text-xs leading-snug text-ink-muted">
            {zoneVsLeagueTier(zonePayload.agg)}
          </p>
          {(() => {
            const u = unusualVsLeagueLine(zonePayload.agg);
            return u ? <p className="text-xs leading-snug text-ink-muted">{u}</p> : null;
          })()}
        </div>
      ) : (
        <p className="mt-2 text-xs text-ink-faint">{emptyLabel}</p>
      )}
    </div>
  );
}

function CourtSkeleton() {
  const { resolvedTheme } = useTheme();
  const courtBg = resolvedTheme === 'light' ? '#efece7' : '#0e1219';
  const zoneFill = resolvedTheme === 'light' ? 'rgb(211 208 200 / 0.55)' : 'rgb(51 59 77 / 0.55)';
  const lineStroke = resolvedTheme === 'light' ? 'rgb(150 154 163 / 0.55)' : 'rgb(102 110 125 / 0.45)';

  return (
    <div className="relative w-full">
      <svg
        viewBox={COURT_VIEWBOX}
        className="block h-auto w-full"
        style={{ background: courtBg, borderRadius: 12 }}
      >
        <g className="court-skeleton-zones">
          {ZONES.map((z) => (
            <path
              key={z.id}
              d={z.d}
              fill={zoneFill}
              fillRule={z.fillRule ?? 'nonzero'}
              stroke="none"
              shapeRendering="geometricPrecision"
            />
          ))}
        </g>
        <g
          className="pointer-events-none"
          fill="none"
          stroke={lineStroke}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
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
      </svg>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
        <span>vs league</span>
        <div className="court-skeleton-legend h-3 w-48 rounded-md bg-line" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid h-[60vh] place-items-center text-center text-ink-muted">
      <div className="space-y-2">
        <div className="font-display text-2xl font-bold uppercase tracking-wide text-ink">
          Where do they shoot from?
        </div>
        <div className="text-sm">
          Search any active NBA player above to see their 2025–26 zone shot map.
        </div>
      </div>
    </div>
  );
}

function LoadingState({ player }: { player: Player }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-ink-muted">
        <Spinner />
        <span>Loading shots for {player.fullName}…</span>
      </div>
      <CourtSkeleton />
    </div>
  );
}

function NoShotsState({
  player,
  seasonType,
}: {
  player: Player;
  seasonType: SeasonType;
}) {
  const description = `${player.fullName} has no ${seasonType.toLowerCase()} attempts in 2025–26.`;
  return (
    <div className="grid h-[60vh] place-items-center text-center text-ink-muted">
      <div className="space-y-1">
        <div className="font-display text-2xl font-bold uppercase tracking-wide text-ink">
          No shots yet
        </div>
        <div className="text-sm">{description}</div>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="grid h-[60vh] place-items-center text-center text-rose-600 dark:text-rose-300">
      <div className="space-y-2">
        <div className="text-lg font-medium">Couldn’t load shots</div>
        <div className="max-w-sm text-sm text-rose-700 dark:text-rose-300/80">{message}</div>
        <div className="text-xs text-ink-faint">
          The NBA stats API is sometimes blocked from cloud IPs (Akamai bot
          protection). Try again in a moment, or see the README for the Python
          sidecar fallback.
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-5 w-5 shrink-0 animate-spin text-ink-muted"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx={12}
        cy={12}
        r={10}
        stroke="currentColor"
        strokeWidth={3}
        opacity={0.2}
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
      />
    </svg>
  );
}
