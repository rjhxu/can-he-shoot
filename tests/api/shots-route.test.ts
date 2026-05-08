import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetShots = vi.fn();
const mockAggregateByZone = vi.fn();
const mockComputeTotals = vi.fn();

vi.mock('@/lib/nba/shots', () => ({
  getShots: mockGetShots,
}));

vi.mock('@/lib/aggregate', () => ({
  aggregateByZone: mockAggregateByZone,
  computeTotals: mockComputeTotals,
}));

describe('GET /api/shots/[playerId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for invalid playerId path param', async () => {
    const { GET } = await import('@/app/api/shots/[playerId]/route');
    const request = new Request('http://localhost/api/shots/not-a-number');

    const response = await GET(request, {
      params: Promise.resolve({ playerId: 'not-a-number' }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.playerId?.[0]).toContain('playerId must be numeric');
  });

  it('returns 400 for invalid seasonType query', async () => {
    const { GET } = await import('@/app/api/shots/[playerId]/route');
    const request = new Request(
      'http://localhost/api/shots/23?seasonType=Preseason',
    );

    const response = await GET(request, {
      params: Promise.resolve({ playerId: '23' }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.seasonType?.[0]).toContain('Invalid enum value');
  });

  it('returns shaped payload for valid request', async () => {
    const shots = [
      {
        gameId: '001',
        gameDate: '2026-01-01',
        period: 1,
        minutesRemaining: 1,
        secondsRemaining: 1,
        actionType: 'Jump Shot',
        shotType: '3PT Field Goal',
        zoneBasic: 'Above the Break 3',
        zoneArea: 'Center(C)',
        zoneRange: '24+ ft.',
        shotDistance: 25,
        locX: 0,
        locY: 200,
        made: true,
      },
    ];
    const leagueAverages = [
      {
        zoneBasic: 'Above the Break 3',
        zoneArea: 'Center(C)',
        zoneRange: '24+ ft.',
        fga: 1000,
        fgm: 360,
        fgPct: 0.36,
      },
    ];
    const zones = [
      {
        zoneBasic: 'Above the Break 3',
        zoneArea: 'Center(C)',
        fgm: 1,
        fga: 1,
        fgPct: 1,
        leagueFgPct: 0.36,
        fgPctDelta: 0.64,
      },
    ];
    const totals = {
      fga: 1,
      fgm: 1,
      fgPct: 1,
      fg3a: 1,
      fg3m: 1,
      fg3Pct: 1,
    };

    mockGetShots.mockResolvedValueOnce({
      shots,
      leagueAverages,
      season: '2025-26',
      seasonType: 'Playoffs',
    });
    mockAggregateByZone.mockReturnValueOnce(zones);
    mockComputeTotals.mockReturnValueOnce(totals);

    const { GET } = await import('@/app/api/shots/[playerId]/route');
    const request = new Request('http://localhost/api/shots/23?seasonType=Playoffs');
    const response = await GET(request, { params: Promise.resolve({ playerId: '23' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      playerId: 23,
      season: '2025-26',
      seasonType: 'Playoffs',
      shots,
      zones,
      totals,
      leagueAverages,
    });
    expect(response.headers.get('cache-control')).toContain('s-maxage=3600');
    expect(mockGetShots).toHaveBeenCalledWith(23, 'Playoffs');
  });

  it('returns 500 when data fetch fails', async () => {
    mockGetShots.mockRejectedValueOnce(new Error('boom'));
    const { GET } = await import('@/app/api/shots/[playerId]/route');
    const request = new Request('http://localhost/api/shots/23');

    const response = await GET(request, { params: Promise.resolve({ playerId: '23' }) });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Internal error fetching shots' });
  });
});
