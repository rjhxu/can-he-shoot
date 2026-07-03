import Link from 'next/link';
import ShotMapView from '@/components/ShotMapView';
import SiteHeader from '@/components/SiteHeader';
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
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 p-6 sm:p-8">
      <SiteHeader />

      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          Browse Players
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Interactive 2025–26 NBA shot map for every active player. Search a
          name, get the zone breakdown.
        </p>
        <Link href="/" className="mt-1 text-sm text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300">
          ← Ask a question
        </Link>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
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
