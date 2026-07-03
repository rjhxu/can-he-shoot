import { describe, expect, it } from 'vitest';
import {
  coerceStatsSeasonType,
  EMPTY_STATS_BY_SEASON_TYPE,
  hasPlayoffStats,
} from '@/lib/statsSeasonTypeTabs';
import type { PlayerSeasonStats } from '@/lib/nba/types';

function sampleStats(seasonType: 'Regular Season' | 'Playoffs'): PlayerSeasonStats {
  return {
    personId: 23,
    season: '2025-26',
    seasonType,
    teamAbbreviation: 'LAL',
    gp: 10,
    min: 35.5,
    fgm: 9,
    fga: 18,
    fgPct: 0.5,
    fg3m: 2,
    fg3a: 6,
    fg3Pct: 0.333,
    ftm: 4,
    fta: 5,
    ftPct: 0.8,
    reb: 7,
    ast: 8,
    tov: 3,
    stl: 1,
    blk: 0,
    pts: 24,
    plusMinus: 4.5,
  };
}

describe('statsSeasonTypeTabs', () => {
  it('hasPlayoffStats is false when playoffs row is missing', () => {
    expect(hasPlayoffStats(EMPTY_STATS_BY_SEASON_TYPE)).toBe(false);
    expect(
      hasPlayoffStats({
        'Regular Season': sampleStats('Regular Season'),
        Playoffs: null,
      }),
    ).toBe(false);
  });

  it('hasPlayoffStats is true when playoffs row exists', () => {
    expect(
      hasPlayoffStats({
        'Regular Season': null,
        Playoffs: sampleStats('Playoffs'),
      }),
    ).toBe(true);
  });

  it('coerceStatsSeasonType keeps Playoffs when available', () => {
    const statsByType = {
      'Regular Season': sampleStats('Regular Season'),
      Playoffs: sampleStats('Playoffs'),
    };
    expect(coerceStatsSeasonType('Playoffs', statsByType)).toBe('Playoffs');
  });

  it('coerceStatsSeasonType falls back to Regular Season when playoffs missing', () => {
    expect(coerceStatsSeasonType('Playoffs', EMPTY_STATS_BY_SEASON_TYPE)).toBe(
      'Regular Season',
    );
  });
});
