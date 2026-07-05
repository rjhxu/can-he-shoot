import type { PlayerSeasonStats, SeasonType } from '@/lib/nba/types';

export type StatsBySeasonType = Record<SeasonType, PlayerSeasonStats | null>;

export const EMPTY_STATS_BY_SEASON_TYPE: StatsBySeasonType = {
  'Regular Season': null,
  Playoffs: null,
};
