import { aggregateByZone, computeTotals } from '@/lib/aggregate';
import type { LeagueZoneAverage, Shot } from '@/lib/nba/types';

function shot(partial: Partial<Shot>): Shot {
  return {
    gameId: '001',
    gameDate: '2026-01-01',
    period: 1,
    minutesRemaining: 1,
    secondsRemaining: 1,
    actionType: 'Jump Shot',
    shotType: '2PT Field Goal',
    zoneBasic: 'Mid-Range',
    zoneArea: 'Center(C)',
    zoneRange: '8-16 ft.',
    shotDistance: 12,
    locX: 0,
    locY: 120,
    made: false,
    ...partial,
  };
}

describe('aggregateByZone', () => {
  it('groups by zone and computes deltas against league averages', () => {
    const shots: Shot[] = [
      shot({ zoneBasic: 'Mid-Range', zoneArea: 'Center(C)', made: true }),
      shot({ zoneBasic: 'Mid-Range', zoneArea: 'Center(C)', made: false }),
      shot({ zoneBasic: 'Restricted Area', zoneArea: 'Center(C)', made: true }),
    ];

    const league: LeagueZoneAverage[] = [
      {
        zoneBasic: 'Mid-Range',
        zoneArea: 'Center(C)',
        zoneRange: '8-16 ft.',
        fga: 100,
        fgm: 40,
        fgPct: 0.4,
      },
    ];

    const result = aggregateByZone(shots, league);
    expect(result).toHaveLength(2);

    const midRange = result.find((z) => z.zoneBasic === 'Mid-Range');
    expect(midRange).toMatchObject({
      zoneArea: 'Center(C)',
      fga: 2,
      fgm: 1,
      fgPct: 0.5,
      leagueFgPct: 0.4,
    });
    expect(midRange?.fgPctDelta).toBeCloseTo(0.1, 8);

    const ra = result.find((z) => z.zoneBasic === 'Restricted Area');
    expect(ra).toMatchObject({
      zoneArea: 'Center(C)',
      fga: 1,
      fgm: 1,
      fgPct: 1,
      leagueFgPct: null,
      fgPctDelta: null,
    });
  });
});

describe('computeTotals', () => {
  it('returns zeros for an empty shot list', () => {
    expect(computeTotals([])).toEqual({
      fga: 0,
      fgm: 0,
      fgPct: 0,
      fg3a: 0,
      fg3m: 0,
      fg3Pct: 0,
    });
  });

  it('computes overall and 3PT totals correctly', () => {
    const shots: Shot[] = [
      shot({ shotType: '3PT Field Goal', made: true }),
      shot({ shotType: '3PT Field Goal', made: false }),
      shot({ shotType: '2PT Field Goal', made: true }),
    ];

    expect(computeTotals(shots)).toEqual({
      fga: 3,
      fgm: 2,
      fgPct: 2 / 3,
      fg3a: 2,
      fg3m: 1,
      fg3Pct: 0.5,
    });
  });
});
