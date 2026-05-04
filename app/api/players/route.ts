import { NextResponse } from 'next/server';
import { getActivePlayers } from '@/lib/nba/players';
import { NbaApiError } from '@/lib/nba/client';

export const revalidate = 86_400;

export async function GET() {
  try {
    const players = await getActivePlayers();
    return NextResponse.json(
      { players, count: players.length },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      },
    );
  } catch (err) {
    if (err instanceof NbaApiError) {
      console.error(`[/api/players] ${err.status} ${err.message}`);
      return NextResponse.json(
        { error: err.message, status: err.status },
        { status: err.status === 504 ? 504 : 502 },
      );
    }
    console.error('[/api/players] unknown error', err);
    return NextResponse.json(
      { error: 'Internal error fetching players' },
      { status: 500 },
    );
  }
}
