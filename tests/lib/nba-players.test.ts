import { beforeEach, describe, expect, it, vi } from 'vitest';

const select = vi.fn();
const eq = vi.fn();
const neq = vi.fn();
const order = vi.fn();

const mockSupabase = {
  from: vi.fn(),
};

vi.mock('@/lib/supabase', () => ({
  getSupabaseServerClient: () => mockSupabase,
}));

describe('getActivePlayers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.from.mockReturnValue({ select });
    select.mockReturnValue({ eq });
    eq.mockReturnValue({ neq });
    neq.mockReturnValue({ order });
  });

  it('maps player rows from Supabase format to app format', async () => {
    order.mockResolvedValueOnce({
      data: [
        {
          person_id: 23,
          display_first_last: 'LeBron James',
          team_id: 1610612747,
          team_abbreviation: 'LAL',
          rosterstatus: '1',
          from_year: '2003',
          to_year: '2026',
        },
      ],
      error: null,
    });

    const { getActivePlayers } = await import('@/lib/nba/players');
    const result = await getActivePlayers();

    expect(result).toEqual([
      {
        personId: 23,
        fullName: 'LeBron James',
        teamId: 1610612747,
        teamAbbreviation: 'LAL',
        rosterStatus: 1,
        fromYear: '2003',
        toYear: '2026',
      },
    ]);
  });

  it('throws a descriptive error when Supabase returns an error', async () => {
    order.mockResolvedValueOnce({
      data: null,
      error: { message: 'permission denied' },
    });

    const { getActivePlayers } = await import('@/lib/nba/players');
    await expect(getActivePlayers()).rejects.toThrow(
      'Failed to fetch players from Supabase: permission denied',
    );
  });
});

describe('extractPersonIdsFromResults', () => {
  it('returns unique person_ids from result rows', async () => {
    const { extractPersonIdsFromResults } = await import('@/lib/nba/players');
    expect(
      extractPersonIdsFromResults(
        ['person_id', 'pts'],
        [{ person_id: 2544, pts: 24.8 }, { person_id: 2544, pts: 25 }],
      ),
    ).toEqual([2544]);
    expect(
      extractPersonIdsFromResults(
        ['person_id', 'pts'],
        [{ person_id: 2544, pts: 24.8 }, { person_id: 201939, pts: 27 }],
      ),
    ).toEqual([2544, 201939]);
  });

  it('returns empty when person_id column is absent', async () => {
    const { extractPersonIdsFromResults } = await import('@/lib/nba/players');
    expect(
      extractPersonIdsFromResults(['display_first_last', 'pts'], [{ display_first_last: 'LeBron James' }]),
    ).toEqual([]);
  });
});

describe('extractPlayerNamesFromResults', () => {
  it('extracts display_first_last values', async () => {
    const { extractPlayerNamesFromResults } = await import('@/lib/nba/players');
    expect(
      extractPlayerNamesFromResults(
        ['display_first_last', 'fg_pct'],
        [{ display_first_last: 'LeBron James', fg_pct: 0.5 }],
      ),
    ).toEqual(['LeBron James']);
  });

  it('falls back to player_name column', async () => {
    const { extractPlayerNamesFromResults } = await import('@/lib/nba/players');
    expect(
      extractPlayerNamesFromResults(
        ['player_name', 'pts'],
        [{ player_name: 'Stephen Curry', pts: 27 }],
      ),
    ).toEqual(['Stephen Curry']);
  });
});
