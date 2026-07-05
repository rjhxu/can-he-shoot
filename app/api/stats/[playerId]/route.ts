import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPlayerStats } from '@/lib/nba/playerStats';
import type { SeasonType } from '@/lib/nba/types';

export const revalidate = 1_800;

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
    const { stats, season } = await getPlayerStats(playerId, seasonType);

    return NextResponse.json(
      {
        playerId,
        season,
        seasonType,
        stats,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      },
    );
  } catch (err) {
    console.error(`[/api/stats/${playerId}] error`, err);
    return NextResponse.json(
      { error: 'Internal error fetching player stats' },
      { status: 500 },
    );
  }
}
