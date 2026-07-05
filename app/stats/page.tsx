import ShotMapView from '@/components/ShotMapView';
import { getActivePlayers } from '@/lib/nba/players';
import type { Player } from '@/lib/nba/types';

export const revalidate = 86_400;

export default async function StatsPage() {
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
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-ink sm:text-5xl">
          Browse Players
        </h1>
        <p className="text-sm text-ink-muted sm:text-base">
          Interactive 2025–26 shot map for every active NBA player. Search a
          name, get the zone breakdown.
        </p>
      </div>

      {loadError ? (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          <div className="font-semibold">Couldn&apos;t load the player list.</div>
          <div className="mt-1 text-rose-700 dark:text-rose-200/80">{loadError}</div>
          <div className="mt-2 text-xs text-rose-600 dark:text-rose-200/60">
            The Supabase data cache may still be warming up. See the README for
            scraper setup details if this persists.
          </div>
        </div>
      ) : (
        <ShotMapView players={players} defaultPlayer={defaultPlayer} />
      )}
    </main>
  );
}
