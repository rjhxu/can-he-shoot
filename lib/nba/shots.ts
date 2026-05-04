import { nbaFetch, nbaUrl, tableToObjects } from './client';
import type {
  LeagueZoneAverage,
  NbaApiResponse,
  SeasonType,
  Shot,
} from './types';

const SEASON = '2025-26';

export interface ShotsPayload {
  shots: Shot[];
  leagueAverages: LeagueZoneAverage[];
  season: string;
  seasonType: SeasonType;
}

type SingleSeasonType = Exclude<SeasonType, 'Career'>;

async function fetchSingleSeasonType(
  playerId: number,
  seasonType: SingleSeasonType,
): Promise<{ shots: Shot[]; leagueAverages: LeagueZoneAverage[] }> {
  const url = nbaUrl('shotchartdetail', {
    AheadBehind: '',
    ClutchTime: '',
    ContextFilter: '',
    ContextMeasure: 'FGA',
    DateFrom: '',
    DateTo: '',
    EndPeriod: 0,
    EndRange: 28800,
    GameID: '',
    GameSegment: '',
    LastNGames: 0,
    LeagueID: '00',
    Location: '',
    Month: 0,
    OpponentTeamID: 0,
    Outcome: '',
    Period: 0,
    PlayerID: playerId,
    PlayerPosition: '',
    PointDiff: '',
    Position: '',
    RangeType: 0,
    RookieYear: '',
    Season: SEASON,
    SeasonSegment: '',
    SeasonType: seasonType,
    StartPeriod: 0,
    StartRange: 0,
    TeamID: 0,
    VsConference: '',
    VsDivision: '',
  });

  const res = await nbaFetch(url, {
    revalidate: 3_600,
    tags: [`shots:${playerId}`],
  });
  const payload = (await res.json()) as NbaApiResponse;

  const shots = tableToObjects(payload, 'Shot_Chart_Detail', (row) => ({
    gameId: String(row.GAME_ID ?? ''),
    gameDate: String(row.GAME_DATE ?? ''),
    period: Number(row.PERIOD ?? 0),
    minutesRemaining: Number(row.MINUTES_REMAINING ?? 0),
    secondsRemaining: Number(row.SECONDS_REMAINING ?? 0),
    actionType: String(row.ACTION_TYPE ?? ''),
    shotType: String(row.SHOT_TYPE ?? ''),
    zoneBasic: String(row.SHOT_ZONE_BASIC ?? ''),
    zoneArea: String(row.SHOT_ZONE_AREA ?? ''),
    zoneRange: String(row.SHOT_ZONE_RANGE ?? ''),
    shotDistance: Number(row.SHOT_DISTANCE ?? 0),
    locX: Number(row.LOC_X ?? 0),
    locY: Number(row.LOC_Y ?? 0),
    made: Number(row.SHOT_MADE_FLAG ?? 0) === 1,
  }));

  const leagueAverages = tableToObjects(
    payload,
    'LeagueAverages',
    (row): LeagueZoneAverage => ({
      zoneBasic: String(row.SHOT_ZONE_BASIC ?? ''),
      zoneArea: String(row.SHOT_ZONE_AREA ?? ''),
      zoneRange: String(row.SHOT_ZONE_RANGE ?? ''),
      fga: Number(row.FGA ?? 0),
      fgm: Number(row.FGM ?? 0),
      fgPct: Number(row.FG_PCT ?? 0),
    }),
  );

  return { shots, leagueAverages };
}

// Merge two sets of league zone averages by (zoneBasic, zoneArea, zoneRange).
// Sum fga and fgm across the two season types, then recompute fgPct = fgm/fga
// so the combined percentage is properly attempt-weighted.
function mergeLeagueAverages(
  a: LeagueZoneAverage[],
  b: LeagueZoneAverage[],
): LeagueZoneAverage[] {
  const byKey = new Map<string, LeagueZoneAverage>();
  const keyOf = (z: LeagueZoneAverage) =>
    `${z.zoneBasic}__${z.zoneArea}__${z.zoneRange}`;

  for (const z of [...a, ...b]) {
    const k = keyOf(z);
    const existing = byKey.get(k);
    if (!existing) {
      byKey.set(k, { ...z });
    } else {
      const fga = existing.fga + z.fga;
      const fgm = existing.fgm + z.fgm;
      byKey.set(k, {
        zoneBasic: existing.zoneBasic,
        zoneArea: existing.zoneArea,
        zoneRange: existing.zoneRange,
        fga,
        fgm,
        fgPct: fga > 0 ? fgm / fga : 0,
      });
    }
  }

  return Array.from(byKey.values());
}

export async function getShots(
  playerId: number,
  seasonType: SeasonType = 'Regular Season',
): Promise<ShotsPayload> {
  if (seasonType === 'Career') {
    const [reg, post] = await Promise.all([
      fetchSingleSeasonType(playerId, 'Regular Season'),
      fetchSingleSeasonType(playerId, 'Playoffs'),
    ]);
    return {
      shots: [...reg.shots, ...post.shots],
      leagueAverages: mergeLeagueAverages(reg.leagueAverages, post.leagueAverages),
      season: SEASON,
      seasonType: 'Career',
    };
  }

  const { shots, leagueAverages } = await fetchSingleSeasonType(
    playerId,
    seasonType,
  );
  return { shots, leagueAverages, season: SEASON, seasonType };
}
