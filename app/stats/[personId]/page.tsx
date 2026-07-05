import Link from 'next/link';
import ShotMapView from '@/components/ShotMapView';
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
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-1.5">
        <Link
          href="/stats"
          className="text-sm font-medium text-accent transition hover:text-accent-hover"
        >
          ← All players
        </Link>
        {matchedPlayer ? (
          <>
            <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-ink sm:text-5xl">
              {matchedPlayer.fullName}
            </h1>
            <p className="text-sm text-ink-muted sm:text-base">
              {matchedPlayer.teamAbbreviation} — 2025–26 shot map
            </p>
          </>
        ) : (
          <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-ink sm:text-5xl">
            Player not found
          </h1>
        )}
      </div>

      {loadError ? (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          <div className="font-semibold">Couldn&apos;t load the player list.</div>
          <div className="mt-1 text-rose-700 dark:text-rose-200/80">{loadError}</div>
        </div>
      ) : !matchedPlayer ? (
        <div className="rounded-2xl border border-line bg-card p-6 text-sm text-ink-muted shadow-sm">
          <p>No player with ID {personId} was found on the active roster.</p>
          <Link
            href="/stats"
            className="mt-3 inline-block font-medium text-accent transition hover:text-accent-hover"
          >
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
