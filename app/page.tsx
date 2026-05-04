import ShotMapView from '@/components/ShotMapView';
import { getActivePlayers } from '@/lib/nba/players';
import type { Player } from '@/lib/nba/types';

// Match the API route's revalidation cadence so the player list stays fresh
// without making the page itself fully dynamic.
export const revalidate = 86_400;

export default async function HomePage() {
  let players: Player[] = [];
  let loadError: string | null = null;
  try {
    players = await getActivePlayers();
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'Failed to load players';
  }

  const defaultPlayer =
    players.find((p) => p.fullName === 'LeBron James') ?? undefined;

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 p-6 sm:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Where He Shoot From
        </h1>
        <p className="text-sm text-slate-400">
          Interactive 2025–26 NBA shot map for every active player. Search a
          name, get the zone breakdown.
        </p>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          <div className="font-semibold">Couldn’t load the player list.</div>
          <div className="mt-1 text-rose-200/80">{loadError}</div>
          <div className="mt-2 text-xs text-rose-200/60">
            stats.nba.com may be rate-limiting this IP. See the README for the
            Python sidecar fallback if this keeps happening.
          </div>
        </div>
      ) : (
        <ShotMapView players={players} defaultPlayer={defaultPlayer} />
      )}

      <footer className="mt-auto pt-6 text-xs text-slate-500">
        Data via stats.nba.com (the same endpoints{' '}
        <code className="text-slate-400">nba_api</code> wraps).
      </footer>
    </main>
  );
}
