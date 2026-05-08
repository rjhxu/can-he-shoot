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
