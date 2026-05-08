import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryState = { personId?: number; seasonType?: string; from?: number; to?: number };

const queryState: QueryState = {};
const select = vi.fn();
const eq = vi.fn();
const order = vi.fn();
const range = vi.fn();

const mockSupabase = {
  from: vi.fn(),
};

vi.mock('@/lib/supabase', () => ({
  getSupabaseServerClient: () => mockSupabase,
}));

describe('getShots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryState.personId = undefined;
    queryState.seasonType = undefined;
    queryState.from = undefined;
    queryState.to = undefined;

    mockSupabase.from.mockImplementation((table: string) => ({
      select: (columns: string) => {
        select(table, columns);
        return {
          eq: (field: string, value: string | number) => {
            if (field === 'person_id') {
              queryState.personId = Number(value);
              return {
                eq: (nextField: string, nextValue: string | number) => {
                  if (nextField === 'season_type') {
                    queryState.seasonType = String(nextValue);
                  }
                  return {
                    order: (_field: string) => ({ range }),
                  };
                },
              };
            }

            if (field === 'season_type') {
              queryState.seasonType = String(value);
              return Promise.resolve({
                data: [
                  {
                    shot_zone_basic: 'Above the Break 3',
                    shot_zone_area: 'Center(C)',
                    shot_zone_range: '24+ ft.',
                    shot_made_flag: 1,
                  },
                  {
                    shot_zone_basic: 'Above the Break 3',
                    shot_zone_area: 'Center(C)',
                    shot_zone_range: '24+ ft.',
                    shot_made_flag: 0,
                  },
                  {
                    shot_zone_basic: 'Restricted Area',
                    shot_zone_area: 'Center(C)',
                    shot_zone_range: 'Less Than 8 ft.',
                    shot_made_flag: 1,
                  },
                ],
                error: null,
              });
            }

            return { eq, order };
          },
        };
      },
    }));

    range.mockImplementation((from: number, to: number) => {
      queryState.from = from;
      queryState.to = to;
      if (queryState.personId === 23) {
        if (from === 0 && to === 999) {
          return Promise.resolve({
            data: Array.from({ length: 1000 }, (_v, idx) => ({
              game_id: `g1-${idx}`,
              game_date: '2026-01-01',
              period: 1,
              minutes_remaining: 10,
              seconds_remaining: 20,
              action_type: 'Jump Shot',
              shot_type: idx % 2 === 0 ? '3PT Field Goal' : '2PT Field Goal',
              shot_zone_basic: 'Above the Break 3',
              shot_zone_area: 'Center(C)',
              shot_zone_range: '24+ ft.',
              shot_distance: 25,
              loc_x: 0,
              loc_y: 200,
              shot_made_flag: idx % 2,
            })),
            error: null,
          });
        }
        return Promise.resolve({
          data: [
            {
              game_id: 'g2',
              game_date: '2026-01-02',
              period: 2,
              minutes_remaining: 8,
              seconds_remaining: 10,
              action_type: 'Layup',
              shot_type: '2PT Field Goal',
              shot_zone_basic: 'Restricted Area',
              shot_zone_area: 'Center(C)',
              shot_zone_range: 'Less Than 8 ft.',
              shot_distance: 1,
              loc_x: 1,
              loc_y: 5,
              shot_made_flag: 1,
            },
          ],
          error: null,
        });
      }

      return Promise.resolve({ data: [], error: null });
    });
  });

  it('paginates player shots and computes league zone averages', async () => {
    const { getShots } = await import('@/lib/nba/shots');
    const payload = await getShots(23, 'Regular Season');

    expect(payload.season).toBe('2025-26');
    expect(payload.seasonType).toBe('Regular Season');
    expect(payload.shots).toHaveLength(1001);
    expect(payload.shots[0]).toMatchObject({
      gameId: 'g1-0',
      zoneBasic: 'Above the Break 3',
    });

    expect(payload.leagueAverages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          zoneBasic: 'Above the Break 3',
          zoneArea: 'Center(C)',
          fga: 2,
          fgm: 1,
          fgPct: 0.5,
        }),
      ]),
    );

    expect(range).toHaveBeenCalledWith(0, 999);
    expect(range).toHaveBeenCalledWith(1000, 1999);
  });
});
