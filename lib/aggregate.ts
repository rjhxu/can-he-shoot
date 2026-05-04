import type {
  LeagueZoneAverage,
  Shot,
  ZoneAggregate,
} from './nba/types';

/**
 * Group shots into (zoneBasic, zoneArea) buckets and compute FG% plus
 * the delta vs league average for the same zone (when available).
 */
export function aggregateByZone(
  shots: Shot[],
  leagueAvgs: LeagueZoneAverage[],
): ZoneAggregate[] {
  const buckets = new Map<string, { fgm: number; fga: number }>();

  for (const s of shots) {
    const key = `${s.zoneBasic}|${s.zoneArea}`;
    const b = buckets.get(key) ?? { fgm: 0, fga: 0 };
    b.fga += 1;
    if (s.made) b.fgm += 1;
    buckets.set(key, b);
  }

  return [...buckets.entries()].map(([key, { fgm, fga }]) => {
    const [zoneBasic, zoneArea] = key.split('|');
    const lg = leagueAvgs.find(
      (l) => l.zoneBasic === zoneBasic && l.zoneArea === zoneArea,
    );
    const fgPct = fga === 0 ? 0 : fgm / fga;
    const leagueFgPct = lg?.fgPct ?? null;
    return {
      zoneBasic,
      zoneArea,
      fgm,
      fga,
      fgPct,
      leagueFgPct,
      fgPctDelta: leagueFgPct === null ? null : fgPct - leagueFgPct,
    };
  });
}

export interface ShootingTotals {
  fga: number;
  fgm: number;
  fgPct: number;
  fg3a: number;
  fg3m: number;
  fg3Pct: number;
}

export function computeTotals(shots: Shot[]): ShootingTotals {
  let fga = 0;
  let fgm = 0;
  let fg3a = 0;
  let fg3m = 0;
  for (const s of shots) {
    fga += 1;
    if (s.made) fgm += 1;
    const isThree = s.shotType.startsWith('3PT');
    if (isThree) {
      fg3a += 1;
      if (s.made) fg3m += 1;
    }
  }
  return {
    fga,
    fgm,
    fgPct: fga === 0 ? 0 : fgm / fga,
    fg3a,
    fg3m,
    fg3Pct: fg3a === 0 ? 0 : fg3m / fg3a,
  };
}
