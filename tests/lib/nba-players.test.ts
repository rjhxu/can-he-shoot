import { beforeEach, describe, expect, it, vi } from 'vitest';

const select = vi.fn();
const eq = vi.fn();
const neq = vi.fn();
const order = vi.fn();
const inFn = vi.fn();

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

describe('resolvePlayerLinksForAsk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.from.mockReturnValue({ select });
    select.mockReturnValue({ in: inFn });
    inFn.mockResolvedValue({ data: [], error: null });
  });

  it('prefers SQL name filters over wrong referenced_player_ids', async () => {
    const ilike = vi.fn().mockResolvedValue({
      data: [
        {
          person_id: 201935,
          display_first_last: 'James Harden',
          team_abbreviation: 'LAC',
        },
      ],
      error: null,
    });
    select.mockReturnValue({ ilike });

    const sql = `
      SELECT period, COUNT(*) AS attempts
      FROM nba_shots s
      JOIN nba_players p ON p.person_id = s.person_id
      WHERE p.display_first_last ILIKE '%harden%'
      GROUP BY period
      LIMIT 50
    `;

    const { resolvePlayerLinksForAsk } = await import('@/lib/nba/players');
    const links = await resolvePlayerLinksForAsk(
      [201942],
      ['period', 'attempts', 'fg_pct'],
      [{ period: 4, attempts: 189, fg_pct: 0.46 }],
      sql,
    );

    expect(links).toEqual([
      { personId: 201935, name: 'James Harden', teamAbbreviation: 'LAC' },
    ]);
    expect(inFn).not.toHaveBeenCalled();
  });

  it('uses person_id from results when present', async () => {
    inFn.mockResolvedValueOnce({
      data: [
        {
          person_id: 201935,
          display_first_last: 'James Harden',
          team_abbreviation: 'LAC',
        },
      ],
      error: null,
    });

    const { resolvePlayerLinksForAsk } = await import('@/lib/nba/players');
    const links = await resolvePlayerLinksForAsk(
      [201942],
      ['person_id', 'period', 'fg_pct'],
      [{ person_id: 201935, period: 4, fg_pct: 0.46 }],
      "WHERE p.display_first_last ILIKE '%harden%'",
    );

    expect(links).toEqual([
      { personId: 201935, name: 'James Harden', teamAbbreviation: 'LAC' },
    ]);
  });
});
