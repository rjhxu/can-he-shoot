import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getShots } from '@/lib/nba/shots';
import { aggregateByZone, computeTotals } from '@/lib/aggregate';
import { NbaApiError } from '@/lib/nba/client';
import type { SeasonType } from '@/lib/nba/types';

export const revalidate = 3_600;

const PathParams = z.object({
  playerId: z.string().regex(/^\d+$/, 'playerId must be numeric'),
});

const QuerySchema = z.object({
  seasonType: z
    .enum(['Regular Season', 'Playoffs'])
    .optional()
    .default('Regular Season'),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ playerId: string }> },
) {
  const resolved = await params;
  const parsed = PathParams.safeParse(resolved);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const playerId = Number(parsed.data.playerId);

  const url = new URL(request.url);
  const queryParsed = QuerySchema.safeParse({
    seasonType: url.searchParams.get('seasonType') ?? undefined,
  });
  if (!queryParsed.success) {
    return NextResponse.json(
      { error: queryParsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const seasonType: SeasonType = queryParsed.data.seasonType;

  try {
    const { shots, leagueAverages, season } = await getShots(playerId, seasonType);
    const zones = aggregateByZone(shots, leagueAverages);
    const totals = computeTotals(shots);

    return NextResponse.json(
      {
        playerId,
        season,
        seasonType,
        shots,
        zones,
        totals,
        leagueAverages,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      },
    );
  } catch (err) {
    if (err instanceof NbaApiError) {
      console.error(
        `[/api/shots/${playerId}] ${err.status} ${err.message}`,
      );
      return NextResponse.json(
        { error: err.message, status: err.status },
        { status: err.status === 504 ? 504 : 502 },
      );
    }
    console.error(`[/api/shots/${playerId}] unknown error`, err);
    return NextResponse.json(
      { error: 'Internal error fetching shots' },
      { status: 500 },
    );
  }
}
