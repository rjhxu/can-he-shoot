'use client';

import { useEffect, useState } from 'react';
import PlayerSearch from './PlayerSearch';
import SeasonTypeToggle from './SeasonTypeToggle';
import ShotChart from './ShotChart';
import { computeTotals, type ShootingTotals } from '@/lib/aggregate';
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

  useEffect(() => {
    if (!selected) {
      setData(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
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
        <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-3 sm:p-4">
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
            />
          ) : null}
        </div>

        <aside className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
          <SidePanel
            player={selected}
            seasonType={seasonType}
            shots={data?.shots ?? []}
            totals={totals}
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
}: {
  player: Player | null;
  seasonType: SeasonType;
  shots: Shot[];
  totals: ShootingTotals | null;
}) {
  if (!player) {
    return (
      <div className="text-sm text-slate-400">
        Pick a player to load their {`'25–'26`} shot map.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <PlayerHeadshot player={player} />
      <div>
        <div className="text-lg font-semibold text-white">{player.fullName}</div>
        <div className="text-xs uppercase tracking-wide text-slate-400">
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
      <p className="text-xs text-slate-500">
        Hover any zone for FG%, attempts, and the league-average comparison.
        Color encodes FG% relative to the league average for that zone — green
        = better, red = worse.
      </p>
    </div>
  );
}

function PlayerHeadshot({ player }: { player: Player }) {
  const [errored, setErrored] = useState(false);
  const initials = player.fullName
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className="-m-4 mb-4">
      {errored ? (
        <div
          className="flex aspect-[260/190] w-full items-center justify-center rounded-t-2xl bg-slate-800 text-lg font-semibold text-slate-300"
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
          className="aspect-[260/190] w-full rounded-t-2xl object-cover"
        />
      )}
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
    <div className="grid h-[60vh] place-items-center text-slate-400">
      <div className="flex items-center gap-3">
        <Spinner />
        <span>Loading shots for {player.fullName}…</span>
      </div>
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
      className="h-5 w-5 animate-spin text-slate-300"
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
