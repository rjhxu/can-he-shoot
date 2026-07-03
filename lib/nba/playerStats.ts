import { unstable_cache } from 'next/cache';
import { getSupabaseServerClient } from '@/lib/supabase';
import type { PlayerSeasonStats, SeasonType } from './types';

const SEASON = '2025-26';
const PER_MODE = 'PerGame';
const MEASURE_TYPE = 'Base';

function num(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function nullableNum(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function fetchPlayerStats(
  playerId: number,
  seasonType: SeasonType,
): Promise<PlayerSeasonStats | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('nba_player_stats')
    .select(
      'person_id, season, season_type, team_abbreviation, gp, min, fgm, fga, fg_pct, fg3m, fg3a, fg3_pct, ftm, fta, ft_pct, reb, ast, tov, stl, blk, pts, plus_minus',
    )
    .eq('person_id', playerId)
    .eq('season', SEASON)
    .eq('season_type', seasonType)
    .eq('per_mode', PER_MODE)
    .eq('measure_type', MEASURE_TYPE)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch player stats from Supabase: ${error.message}`);
  }

  if (!data) return null;

  return {
    personId: Number(data.person_id),
    season: String(data.season ?? SEASON),
    seasonType: String(data.season_type ?? seasonType) as SeasonType,
    teamAbbreviation: String(data.team_abbreviation ?? ''),
    gp: num(data.gp),
    min: num(data.min),
    fgm: num(data.fgm),
    fga: num(data.fga),
    fgPct: num(data.fg_pct),
    fg3m: num(data.fg3m),
    fg3a: num(data.fg3a),
    fg3Pct: num(data.fg3_pct),
    ftm: num(data.ftm),
    fta: num(data.fta),
    ftPct: num(data.ft_pct),
    reb: num(data.reb),
    ast: num(data.ast),
    tov: num(data.tov),
    stl: num(data.stl),
    blk: num(data.blk),
    pts: num(data.pts),
    plusMinus: nullableNum(data.plus_minus),
  };
}

export async function getPlayerStats(
  playerId: number,
  seasonType: SeasonType = 'Regular Season',
): Promise<{ stats: PlayerSeasonStats | null; season: string; seasonType: SeasonType }> {
  const cacheKey = `nba_player_stats_${playerId}_${seasonType}`;
  const cachedGetter = unstable_cache(
    async () => fetchPlayerStats(playerId, seasonType),
    [cacheKey],
    { revalidate: 1_800 },
  );
  const stats = await cachedGetter();
  return { stats, season: SEASON, seasonType };
}
