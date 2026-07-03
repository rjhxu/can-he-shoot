export type ZoneBasic =
  | 'Restricted Area'
  | 'In The Paint (Non-RA)'
  | 'Mid-Range'
  | 'Left Corner 3'
  | 'Right Corner 3'
  | 'Above the Break 3'
  | 'Backcourt';

export type ZoneArea =
  | 'Center(C)'
  | 'Left Side(L)'
  | 'Left Side Center(LC)'
  | 'Right Side(R)'
  | 'Right Side Center(RC)'
  | 'Back Court(BC)';

export type SeasonType = 'Regular Season' | 'Playoffs';

export interface Player {
  personId: number;
  fullName: string;
  teamId: number;
  teamAbbreviation: string;
  rosterStatus: number;
  fromYear: string;
  toYear: string;
}

export interface Shot {
  gameId: string;
  gameDate: string;
  period: number;
  minutesRemaining: number;
  secondsRemaining: number;
  actionType: string;
  shotType: string;
  zoneBasic: ZoneBasic | string;
  zoneArea: ZoneArea | string;
  zoneRange: string;
  shotDistance: number;
  locX: number;
  locY: number;
  made: boolean;
}

export interface LeagueZoneAverage {
  zoneBasic: string;
  zoneArea: string;
  zoneRange: string;
  fga: number;
  fgm: number;
  fgPct: number;
}

export interface ZoneAggregate {
  zoneBasic: string;
  zoneArea: string;
  fgm: number;
  fga: number;
  fgPct: number;
  leagueFgPct: number | null;
  fgPctDelta: number | null;
}

export interface NbaApiTable {
  name: string;
  headers: string[];
  rowSet: unknown[][];
}

export interface NbaApiResponse {
  resource: string;
  parameters: Record<string, unknown>;
  resultSets: NbaApiTable[];
}

export interface PlayerSeasonStats {
  personId: number;
  season: string;
  seasonType: SeasonType;
  teamAbbreviation: string;
  gp: number;
  min: number;
  fgm: number;
  fga: number;
  fgPct: number;
  fg3m: number;
  fg3a: number;
  fg3Pct: number;
  ftm: number;
  fta: number;
  ftPct: number;
  reb: number;
  ast: number;
  tov: number;
  stl: number;
  blk: number;
  pts: number;
  plusMinus: number | null;
}
