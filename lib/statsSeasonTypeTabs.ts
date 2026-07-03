import type { PlayerSeasonStats, SeasonType } from '@/lib/nba/types';

export type StatsBySeasonType = Record<SeasonType, PlayerSeasonStats | null>;

export const EMPTY_STATS_BY_SEASON_TYPE: StatsBySeasonType = {
  'Regular Season': null,
  Playoffs: null,
};

export function hasPlayoffStats(statsByType: StatsBySeasonType): boolean {
  return statsByType.Playoffs !== null;
}

export function coerceStatsSeasonType(
  statsSeasonType: SeasonType,
  statsByType: StatsBySeasonType,
): SeasonType {
  if (statsSeasonType === 'Playoffs' && !hasPlayoffStats(statsByType)) {
    return 'Regular Season';
  }
  return statsSeasonType;
}
