import { unstable_cache } from 'next/cache';
import { getSupabaseServerClient } from '@/lib/supabase';
import type {
  LeagueZoneAverage,
  SeasonType,
  Shot,
} from './types';

import { CURRENT_SEASON } from './season';
const SHOTS_PAGE_SIZE = 1_000;

async function fetchAllPlayerShots(
  playerId: number,
  seasonType: SeasonType,
): Promise<
  Array<{
    game_id: string | null;
    game_date: string | null;
    period: number | null;
    minutes_remaining: number | null;
    seconds_remaining: number | null;
    action_type: string | null;
    shot_type: string | null;
    shot_zone_basic: string | null;
    shot_zone_area: string | null;
    shot_zone_range: string | null;
    shot_distance: number | null;
    loc_x: number | null;
    loc_y: number | null;
    shot_made_flag: number | null;
  }>
> {
  const supabase = getSupabaseServerClient();
  const allRows: Array<{
    game_id: string | null;
    game_date: string | null;
    period: number | null;
    minutes_remaining: number | null;
    seconds_remaining: number | null;
    action_type: string | null;
    shot_type: string | null;
    shot_zone_basic: string | null;
    shot_zone_area: string | null;
    shot_zone_range: string | null;
    shot_distance: number | null;
    loc_x: number | null;
    loc_y: number | null;
    shot_made_flag: number | null;
  }> = [];
  let from = 0;

  while (true) {
    const to = from + SHOTS_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('nba_shots')
      .select(
        'game_id, game_date, period, minutes_remaining, seconds_remaining, action_type, shot_type, shot_zone_basic, shot_zone_area, shot_zone_range, shot_distance, loc_x, loc_y, shot_made_flag',
      )
      .eq('person_id', playerId)
      .eq('season_type', seasonType)
      .order('game_date', { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch shots from Supabase: ${error.message}`);
    }

    const rows = data ?? [];
    allRows.push(...rows);

    if (rows.length < SHOTS_PAGE_SIZE) {
      break;
    }

    from += SHOTS_PAGE_SIZE;
  }

  return allRows;
}

export interface ShotsPayload {
  shots: Shot[];
  leagueAverages: LeagueZoneAverage[];
  season: string;
  seasonType: SeasonType;
}

async function fetchSingleSeasonType(
  playerId: number,
  seasonType: SeasonType,
): Promise<{ shots: Shot[]; leagueAverages: LeagueZoneAverage[] }> {
  const supabase = getSupabaseServerClient();
  const shotRows = await fetchAllPlayerShots(playerId, seasonType);

  const shots: Shot[] = (shotRows ?? []).map((row) => ({
    gameId: String(row.game_id ?? ''),
    gameDate: String(row.game_date ?? ''),
    period: Number(row.period ?? 0),
    minutesRemaining: Number(row.minutes_remaining ?? 0),
    secondsRemaining: Number(row.seconds_remaining ?? 0),
    actionType: String(row.action_type ?? ''),
    shotType: String(row.shot_type ?? ''),
    zoneBasic: String(row.shot_zone_basic ?? ''),
    zoneArea: String(row.shot_zone_area ?? ''),
    zoneRange: String(row.shot_zone_range ?? ''),
    shotDistance: Number(row.shot_distance ?? 0),
    locX: Number(row.loc_x ?? 0),
    locY: Number(row.loc_y ?? 0),
    made: Number(row.shot_made_flag ?? 0) === 1,
  }));

  const { data: leagueRows, error: leagueError } = await supabase
    .from('nba_shots')
    .select('shot_zone_basic, shot_zone_area, shot_zone_range, shot_made_flag')
    .eq('season_type', seasonType);

  if (leagueError) {
    throw new Error(
      `Failed to fetch league averages from Supabase: ${leagueError.message}`,
    );
  }

  const grouped = new Map<string, { fga: number; fgm: number }>();
  for (const row of leagueRows ?? []) {
    const zoneBasic = String(row.shot_zone_basic ?? '');
    const zoneArea = String(row.shot_zone_area ?? '');
    const zoneRange = String(row.shot_zone_range ?? '');
    const key = `${zoneBasic}__${zoneArea}__${zoneRange}`;
    const current = grouped.get(key) ?? { fga: 0, fgm: 0 };
    current.fga += 1;
    current.fgm += Number(row.shot_made_flag ?? 0) === 1 ? 1 : 0;
    grouped.set(key, current);
  }

  const leagueAverages: LeagueZoneAverage[] = Array.from(grouped.entries()).map(
    ([key, value]) => {
      const [zoneBasic, zoneArea, zoneRange] = key.split('__');
      const fgPct = value.fga > 0 ? value.fgm / value.fga : 0;
      return { zoneBasic, zoneArea, zoneRange, fga: value.fga, fgm: value.fgm, fgPct };
    },
  );

  return { shots, leagueAverages };
}

export async function getShots(
  playerId: number,
  seasonType: SeasonType = 'Regular Season',
): Promise<ShotsPayload> {
  const cacheKey = `nba_shots_${playerId}_${seasonType}`;
  const cachedGetter = unstable_cache(
    async () => fetchSingleSeasonType(playerId, seasonType),
    [cacheKey],
    { revalidate: 1_800 },
  );
  const { shots, leagueAverages } = await cachedGetter();
  return { shots, leagueAverages, season: CURRENT_SEASON, seasonType };
}
