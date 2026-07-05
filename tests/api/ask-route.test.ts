import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockGenerateSql = vi.fn();
const mockSummarizeResults = vi.fn();
const mockQueryReadonly = vi.fn();
const mockResolvePlayerLinksForAsk = vi.fn();
const mockResolvePlayersFromSqlNameFilters = vi.fn();
const mockCheckRateLimit = vi.fn();

vi.mock('@/lib/cohere/client', () => ({
  generateSql: mockGenerateSql,
  summarizeResults: mockSummarizeResults,
}));

vi.mock('@/lib/db/readonlyClient', () => ({
  queryReadonly: mockQueryReadonly,
  isDbTimeoutError: (err: unknown) =>
    err instanceof Error && err.message.includes('statement timeout'),
}));

vi.mock('@/lib/nba/players', () => ({
  resolvePlayerLinksForAsk: mockResolvePlayerLinksForAsk,
  resolvePlayersFromSqlNameFilters: mockResolvePlayersFromSqlNameFilters,
}));

vi.mock('@/lib/rateLimit', () => ({
  checkRateLimit: mockCheckRateLimit,
}));

function makeRequest(body: unknown, ip = '127.0.0.1') {
  return new NextRequest('http://localhost/api/ask', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/ask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true });
    mockResolvePlayersFromSqlNameFilters.mockResolvedValue([]);
  });

  it('returns the full response shape on success', async () => {
    mockGenerateSql.mockResolvedValueOnce({
      sql: 'SELECT p.display_first_last, st.pts FROM nba_player_stats st JOIN nba_players p ON p.person_id = st.person_id LIMIT 5',
      referenced_player_ids: [2544],
    });
    mockQueryReadonly.mockResolvedValueOnce({
      columns: ['display_first_last', 'pts'],
      rows: [{ display_first_last: 'LeBron James', pts: 24.8 }],
    });
    mockResolvePlayerLinksForAsk.mockResolvedValueOnce([
      { personId: 2544, name: 'LeBron James', teamAbbreviation: 'LAL' },
    ]);
    mockSummarizeResults.mockResolvedValueOnce(
      'LeBron James averaged 24.8 points per game this season.',
    );

    const { POST } = await import('@/app/api/ask/route');
    const response = await POST(
      makeRequest({ question: 'How many points did LeBron average this season?' }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      question: 'How many points did LeBron average this season?',
      columns: ['display_first_last', 'pts'],
      answer: 'LeBron James averaged 24.8 points per game this season.',
      playerLinks: [{ personId: 2544, name: 'LeBron James', teamAbbreviation: 'LAL' }],
    });
    expect(body.sql).toContain('LIMIT');
  });

  it('returns 400 for invalid SQL', async () => {
    mockGenerateSql.mockResolvedValueOnce({
      sql: 'DELETE FROM nba_players',
      referenced_player_ids: [],
    });

    const { POST } = await import('@/app/api/ask/route');
    const response = await POST(makeRequest({ question: 'delete everything' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('safely');
  });

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockReturnValueOnce({ allowed: false, retryAfterSec: 120 });

    const { POST } = await import('@/app/api/ask/route');
    const response = await POST(makeRequest({ question: 'test question here' }));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toContain('Too many questions');
  });

  it('returns 503 on Cohere failure', async () => {
    mockGenerateSql.mockRejectedValueOnce(new Error('Cohere API error'));

    const { POST } = await import('@/app/api/ask/route');
    const response = await POST(makeRequest({ question: 'test question here' }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toContain('temporarily unavailable');
  });

  it('returns a clear message for opponent questions without calling Cohere', async () => {
    mockResolvePlayersFromSqlNameFilters.mockResolvedValueOnce([
      { personId: 2544, name: 'LeBron James', teamAbbreviation: 'LAL' },
    ]);

    const { POST } = await import('@/app/api/ask/route');
    const response = await POST(
      makeRequest({ question: 'How did LeBron shoot against the Celtics?' }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.answer).toContain("can't answer matchup questions");
    expect(body.rows).toEqual([]);
    expect(body.playerLinks).toEqual([
      { personId: 2544, name: 'LeBron James', teamAbbreviation: 'LAL' },
    ]);
    expect(mockGenerateSql).not.toHaveBeenCalled();
    expect(mockQueryReadonly).not.toHaveBeenCalled();
  });

  it('returns 200 with empty results', async () => {
    mockGenerateSql.mockResolvedValueOnce({
      sql: 'SELECT 1 WHERE false LIMIT 1',
      referenced_player_ids: [],
    });
    mockQueryReadonly.mockResolvedValueOnce({ columns: [], rows: [] });
    mockResolvePlayerLinksForAsk.mockResolvedValueOnce([]);
    mockSummarizeResults.mockResolvedValueOnce(
      'No matching data was found. Try rephrasing your question.',
    );

    const { POST } = await import('@/app/api/ask/route');
    const response = await POST(
      makeRequest({ question: 'What was his corner three percentage?' }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.rows).toEqual([]);
    expect(body.answer).toContain('No matching data');
  });
});
