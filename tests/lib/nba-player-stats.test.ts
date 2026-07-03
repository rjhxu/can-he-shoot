import { beforeEach, describe, expect, it, vi } from 'vitest';

const maybeSingle = vi.fn();
const eq = vi.fn();

const mockSupabase = {
  from: vi.fn(),
};

vi.mock('@/lib/supabase', () => ({
  getSupabaseServerClient: () => mockSupabase,
}));

describe('getPlayerStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    eq.mockImplementation(() => ({ eq, maybeSingle }));
    mockSupabase.from.mockImplementation(() => ({
      select: () => ({ eq }),
    }));
  });

  it('maps Supabase row to PlayerSeasonStats', async () => {
    maybeSingle.mockResolvedValueOnce({
      data: {
        person_id: 23,
        season: '2025-26',
        season_type: 'Regular Season',
        team_abbreviation: 'LAL',
        gp: 52,
        min: 34.2,
        fgm: 9,
        fga: 18,
        fg_pct: 0.5,
        fg3m: 2,
        fg3a: 6,
        fg3_pct: 0.333,
        ftm: 4,
        fta: 5,
        ft_pct: 0.8,
        reb: 7,
        ast: 8,
        tov: 3,
        stl: 1,
        blk: 0,
        pts: 24,
        plus_minus: 4.5,
      },
      error: null,
    });

    const { getPlayerStats } = await import('@/lib/nba/playerStats');
    const { stats } = await getPlayerStats(23, 'Regular Season');

    expect(stats).toEqual({
      personId: 23,
      season: '2025-26',
      seasonType: 'Regular Season',
      teamAbbreviation: 'LAL',
      gp: 52,
      min: 34.2,
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
    });
    expect(mockSupabase.from).toHaveBeenCalledWith('nba_player_stats');
  });

  it('returns null when no stats row exists', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const { getPlayerStats } = await import('@/lib/nba/playerStats');
    const { stats } = await getPlayerStats(999, 'Regular Season');

    expect(stats).toBeNull();
  });

  it('throws when Supabase returns an error', async () => {
    maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'connection failed' },
    });

    const { getPlayerStats } = await import('@/lib/nba/playerStats');
    await expect(getPlayerStats(23, 'Regular Season')).rejects.toThrow(
      'Failed to fetch player stats from Supabase: connection failed',
    );
  });
});
