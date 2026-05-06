import { NextResponse } from 'next/server';
import { getActivePlayers } from '@/lib/nba/players';

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
    console.error('[/api/players] error', err);
    return NextResponse.json(
      { error: 'Internal error fetching players' },
      { status: 500 },
    );
  }
}
