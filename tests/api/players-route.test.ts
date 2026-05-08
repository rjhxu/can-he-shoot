import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetActivePlayers = vi.fn();

vi.mock('@/lib/nba/players', () => ({
  getActivePlayers: mockGetActivePlayers,
}));

describe('GET /api/players', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns players and count on success', async () => {
    mockGetActivePlayers.mockResolvedValueOnce([
      { personId: 23, fullName: 'LeBron James' },
      { personId: 30, fullName: 'Stephen Curry' },
    ]);

    const { GET } = await import('@/app/api/players/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      players: [
        { personId: 23, fullName: 'LeBron James' },
        { personId: 30, fullName: 'Stephen Curry' },
      ],
      count: 2,
    });
    expect(response.headers.get('cache-control')).toContain('s-maxage=86400');
  });

  it('returns 500 when player loading fails', async () => {
    mockGetActivePlayers.mockRejectedValueOnce(new Error('db unavailable'));

    const { GET } = await import('@/app/api/players/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Internal error fetching players' });
  });
});
