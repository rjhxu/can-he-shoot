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

export async function getShots(
  playerId: number,
  seasonType: SeasonType = 'Regular Season',
): Promise<ShotsPayload> {
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

  return { shots, leagueAverages, season: SEASON, seasonType };
}
