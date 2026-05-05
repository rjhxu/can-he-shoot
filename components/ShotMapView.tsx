'use client';

import { useEffect, useState } from 'react';
import PlayerSearch from './PlayerSearch';
import SeasonTypeToggle from './SeasonTypeToggle';
import ShotChart, { type ZoneHoverPayload } from './ShotChart';
import { computeTotals, type ShootingTotals } from '@/lib/aggregate';
import { fmtPct, fmtSignedPp } from '@/lib/formatShot';
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
import type {
  LeagueZoneAverage,
  Player,
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

export default function ShotMapView({ players, defaultPlayer }: Props) {
  const [selected, setSelected] = useState<Player | null>(defaultPlayer ?? null);
  const [seasonType, setSeasonType] = useState<SeasonType>('Regular Season');
  const [data, setData] = useState<ShotsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredZone, setHoveredZone] = useState<ZoneHoverPayload | null>(null);

  useEffect(() => {
    setHoveredZone(null);
  }, [selected, seasonType]);

  useEffect(() => {
    if (!selected) {
      setData(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setHoveredZone(null);
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

  const totals = data?.totals ?? (data ? computeTotals(data.shots) : null);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <PlayerSearch
            players={players}
            selected={selected}
            onSelect={setSelected}
          />
        </div>
        <SeasonTypeToggle value={seasonType} onChange={setSeasonType} />
      </header>

      <section className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="rounded-2xl border border-white/10 bg-slate-900/35 p-2 backdrop-blur-md sm:p-3">
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
              hoveredZoneId={hoveredZone?.zone.id ?? null}
              onZoneHover={setHoveredZone}
            />
          ) : null}
        </div>

        <aside className="relative overflow-visible rounded-2xl border border-white/10 bg-slate-900/35 px-4 pb-4 pt-16 backdrop-blur-md">
          <SidePanel
            player={selected}
            seasonType={seasonType}
            shots={data?.shots ?? []}
            totals={totals}
            hoveredZone={hoveredZone}
            loading={loading && !!selected}
          />
        </aside>
      </section>
    </div>
  );
}

function SidePanel({
  player,
  seasonType,
  shots,
  totals,
  hoveredZone,
  loading,
}: {
  player: Player | null;
  seasonType: SeasonType;
  shots: Shot[];
  totals: ShootingTotals | null;
  hoveredZone: ZoneHoverPayload | null;
  loading: boolean;
}) {
  if (!player) {
    return (
      <div className="text-sm text-slate-400">
        Pick a player to load their {`'25–'26`} shot map.
      </div>
    );
  }

  const glow = teamGlowColors(player.teamAbbreviation);

  return (
    <div className="space-y-4">
      <PlayerHeadshot player={player} glow={glow} />
      <div>
        <div className="text-lg font-semibold text-white">{player.fullName}</div>
        <div className="text-xs uppercase tracking-wide text-slate-400">
          {player.teamAbbreviation || '—'} · {seasonType}
        </div>
      </div>

      {hoveredZone && !loading && (
        <div className="rounded-lg border border-cyan-400/35 bg-slate-950/55 p-3 text-sm shadow-[0_0_24px_-4px_rgba(34,211,238,0.35)]">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-cyan-300/95">
            Hovered zone
          </div>
          <div className="mt-0.5 font-medium text-white">{hoveredZone.zone.label}</div>
          {hoveredZone.agg && hoveredZone.agg.fga > 0 ? (
            <div className="mt-2 space-y-1.5 text-slate-200">
              <div>
                <span className="text-slate-400">FGM/FGA </span>
                <span className="font-semibold text-white">
                  {hoveredZone.agg.fgm} / {hoveredZone.agg.fga}
                </span>
              </div>
              <div>
                <span className="text-slate-400">FG% </span>
                <span className="font-semibold text-white">
                  {fmtPct(hoveredZone.agg.fgPct)}
                </span>
                <span className="text-slate-500"> · league </span>
                <span>{fmtPct(hoveredZone.agg.leagueFgPct)}</span>
                {hoveredZone.agg.fgPctDelta !== null && (
                  <span
                    className={
                      hoveredZone.agg.fgPctDelta >= 0
                        ? ' ml-1 font-medium text-emerald-400'
                        : ' ml-1 font-medium text-rose-400'
                    }
                  >
                    ({fmtSignedPp(hoveredZone.agg.fgPctDelta)})
                  </span>
                )}
              </div>
              <p className="text-xs leading-snug text-slate-400">
                {zoneVsLeagueTier(hoveredZone.agg)}
              </p>
              {(() => {
                const u = unusualVsLeagueLine(hoveredZone.agg);
                return u ? (
                  <p className="text-xs leading-snug text-slate-500">{u}</p>
                ) : null;
              })()}
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-400">No attempts in this zone.</p>
          )}
        </div>
      )}

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
      <p className="text-xs text-slate-500">
        Colors compare each zone’s FG% to the league average for that zone
        (green above, red below). Hover the court to highlight a zone and see
        details here; the chart tooltip shows the same numbers.
      </p>
    </div>
  );
}

function PlayerHeadshot({
  player,
  glow,
}: {
  player: Player;
  glow: { primary: string; secondary: string };
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
          className="relative z-10 flex aspect-[260/190] w-full items-center justify-center rounded-xl bg-slate-800 text-lg font-semibold text-slate-300 ring-1 ring-white/10"
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
          className="relative z-10 aspect-[260/190] w-full rounded-xl object-cover ring-1 ring-white/10"
        />
      )}
    </>
  );

  return (
    <div className="relative -mt-14 mb-2 w-full">
      <div
        className="relative w-full rounded-xl"
        style={{
          boxShadow: `0 0 0 1px rgba(255,255,255,0.08), 0 18px 48px -12px ${glow.primary}aa, 0 8px 28px -8px ${glow.secondary}99`,
        }}
      >
        {shell}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function CourtSkeleton() {
  return (
    <div className="relative w-full">
      <svg
        viewBox={COURT_VIEWBOX}
        className="block h-auto w-full"
        style={{ background: '#0e1422', borderRadius: 12 }}
      >
        <g className="court-skeleton-zones">
          {ZONES.map((z) => (
            <path
              key={z.id}
              d={z.d}
              fill="rgb(51 65 85 / 0.55)"
              fillRule={z.fillRule ?? 'nonzero'}
              stroke="none"
              shapeRendering="geometricPrecision"
            />
          ))}
        </g>
        <g
          className="pointer-events-none"
          fill="none"
          stroke="rgb(71 85 105 / 0.45)"
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
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>vs league</span>
        <div className="court-skeleton-legend h-3 w-48 rounded-md bg-slate-700/60" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid h-[60vh] place-items-center text-center text-slate-400">
      <div className="space-y-2">
        <div className="text-lg font-medium text-slate-200">
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
      <div className="flex items-center gap-2 text-xs text-slate-400">
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
    <div className="grid h-[60vh] place-items-center text-center text-slate-400">
      <div className="space-y-1">
        <div className="text-lg font-medium text-slate-200">No shots yet</div>
        <div className="text-sm">{description}</div>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="grid h-[60vh] place-items-center text-center text-rose-300">
      <div className="space-y-2">
        <div className="text-lg font-medium">Couldn’t load shots</div>
        <div className="max-w-sm text-sm text-rose-300/80">{message}</div>
        <div className="text-xs text-slate-500">
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
      className="h-5 w-5 shrink-0 animate-spin text-slate-300"
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
