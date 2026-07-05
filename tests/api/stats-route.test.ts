import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetPlayerStats = vi.fn();

vi.mock('@/lib/nba/playerStats', () => ({
  getPlayerStats: mockGetPlayerStats,
}));

describe('GET /api/stats/[playerId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for invalid playerId path param', async () => {
    const { GET } = await import('@/app/api/stats/[playerId]/route');
    const request = new Request('http://localhost/api/stats/not-a-number');

    const response = await GET(request, {
      params: Promise.resolve({ playerId: 'not-a-number' }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.playerId?.[0]).toContain('playerId must be numeric');
  });

  it('returns 400 for invalid seasonType query', async () => {
    const { GET } = await import('@/app/api/stats/[playerId]/route');
    const request = new Request(
      'http://localhost/api/stats/23?seasonType=Preseason',
    );

    const response = await GET(request, {
      params: Promise.resolve({ playerId: '23' }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.seasonType?.[0]).toContain('Invalid enum value');
  });

  it('returns shaped payload for valid request', async () => {
    const stats = {
      personId: 23,
      season: '2025-26',
      seasonType: 'Playoffs' as const,
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

    mockGetPlayerStats.mockResolvedValueOnce({
      stats,
      season: '2025-26',
      seasonType: 'Playoffs',
    });

    const { GET } = await import('@/app/api/stats/[playerId]/route');
    const request = new Request('http://localhost/api/stats/23?seasonType=Playoffs');
    const response = await GET(request, { params: Promise.resolve({ playerId: '23' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      playerId: 23,
      season: '2025-26',
      seasonType: 'Playoffs',
      stats,
    });
    expect(response.headers.get('cache-control')).toContain('s-maxage=3600');
    expect(mockGetPlayerStats).toHaveBeenCalledWith(23, 'Playoffs');
  });

  it('returns null stats when player has no row', async () => {
    mockGetPlayerStats.mockResolvedValueOnce({
      stats: null,
      season: '2025-26',
      seasonType: 'Regular Season',
    });

    const { GET } = await import('@/app/api/stats/[playerId]/route');
    const request = new Request('http://localhost/api/stats/999');
    const response = await GET(request, { params: Promise.resolve({ playerId: '999' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stats).toBeNull();
  });

  it('returns 500 when data fetch fails', async () => {
    mockGetPlayerStats.mockRejectedValueOnce(new Error('boom'));
    const { GET } = await import('@/app/api/stats/[playerId]/route');
    const request = new Request('http://localhost/api/stats/23');

    const response = await GET(request, { params: Promise.resolve({ playerId: '23' }) });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Internal error fetching player stats' });
  });
});
