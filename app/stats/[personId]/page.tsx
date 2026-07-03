import Link from 'next/link';
import ShotMapView from '@/components/ShotMapView';
import SiteHeader from '@/components/SiteHeader';
import { getActivePlayers } from '@/lib/nba/players';
import type { Player } from '@/lib/nba/types';

export const revalidate = 86_400;

interface Props {
  params: Promise<{ personId: string }>;
}

export default async function StatsPlayerPage({ params }: Props) {
  const { personId } = await params;
  const personIdNum = Number(personId);

  let players: Player[] = [];
  let loadError: string | null = null;
  try {
    players = await getActivePlayers();
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'Failed to load players';
  }

  const matchedPlayer =
    Number.isFinite(personIdNum) && personIdNum > 0
      ? players.find((p) => p.personId === personIdNum)
      : undefined;

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 p-6 sm:p-8">
      <SiteHeader />

      <div className="flex flex-col gap-1">
        <Link href="/" className="text-sm text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300">
          ← Ask a question
        </Link>
        {matchedPlayer ? (
          <>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
              {matchedPlayer.fullName}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {matchedPlayer.teamAbbreviation} — 2025–26 shot map
            </p>
          </>
        ) : (
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Player not found
          </h1>
        )}
      </div>

      {loadError ? (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          <div className="font-semibold">Couldn&apos;t load the player list.</div>
          <div className="mt-1 text-rose-700 dark:text-rose-200/80">{loadError}</div>
        </div>
      ) : !matchedPlayer ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700/50 dark:bg-slate-900/35 dark:text-slate-300 dark:shadow-none">
          <p>No player with ID {personId} was found on the active roster.</p>
          <Link href="/stats" className="mt-3 inline-block text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300">
            Browse all players →
          </Link>
        </div>
      ) : (
        <ShotMapView
          key={personIdNum}
          players={players}
          defaultPlayer={matchedPlayer}
        />
      )}

    </main>
  );
}
