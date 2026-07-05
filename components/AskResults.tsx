'use client';

import Link from 'next/link';
import { useState } from 'react';
import { renderEnrichedAnswer } from '@/lib/renderAskAnswer';
import { teamTextColor } from '@/lib/teamColors';

export interface AskResponse {
  question: string;
  sql: string;
  columns: string[];
  rows: Record<string, unknown>[];
  answer: string;
  playerLinks: { personId: number; name: string; teamAbbreviation: string }[];
}

const MAX_DISPLAY_ROWS = 50;

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, '');
  }
  return String(value);
}

function PlayerLinkCard({
  personId,
  name,
  teamAbbreviation,
}: {
  personId: number;
  name: string;
  teamAbbreviation: string;
}) {
  const [errored, setErrored] = useState(false);
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Link
      href={`/stats/${personId}`}
      className="group flex items-center gap-4 rounded-2xl border border-line bg-card p-3 shadow-sm transition hover:border-accent/50 sm:p-4"
    >
      <div className="h-16 w-[4.4rem] shrink-0 overflow-hidden rounded-xl bg-panel">
        {errored ? (
          <div
            className="flex h-full w-full items-center justify-center text-sm font-semibold text-ink-muted"
            aria-label={`${name} headshot`}
          >
            {initials || '—'}
          </div>
        ) : (
          <img
            src={`https://cdn.nba.com/headshots/nba/latest/260x190/${personId}.png`}
            alt={`${name} headshot`}
            loading="lazy"
            onError={() => setErrored(true)}
            className="h-full w-full object-cover object-top"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="truncate font-semibold"
          style={{ color: teamTextColor(teamAbbreviation) }}
        >
          {name}
        </div>
        <div className="mt-0.5 text-sm font-medium text-accent transition group-hover:text-accent-hover">
          View shot chart →
        </div>
      </div>
    </Link>
  );
}

interface Props {
  result: AskResponse | null;
  loading: boolean;
  error: string | null;
}

export default function AskResults({ result, loading, error }: Props) {
  const [showSql, setShowSql] = useState(false);

  if (loading) {
    return (
      <div className="w-full space-y-4">
        <div className="h-9 w-3/4 animate-pulse rounded-lg bg-line" />
        <div className="h-4 w-full animate-pulse rounded bg-line court-skeleton-legend" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-line court-skeleton-legend" />
        <div className="mt-6 h-48 animate-pulse rounded-2xl border border-line bg-panel" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
        <div className="font-semibold">Couldn&apos;t answer that question.</div>
        <div className="mt-1 text-rose-700 dark:text-rose-200/80">{error}</div>
      </div>
    );
  }

  if (!result) return null;

  const displayRows = result.rows.slice(0, MAX_DISPLAY_ROWS);
  const hiddenCount = result.rows.length - displayRows.length;

  return (
    <div className="w-full space-y-6">
      <div className="rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
        <div className="text-xs font-medium uppercase tracking-widest text-ink-faint">
          {result.question}
        </div>
        <p className="mt-2 text-xl font-semibold leading-snug text-ink sm:text-2xl">
          {renderEnrichedAnswer(result.answer, {
            playerLinks: result.playerLinks,
            rows: result.rows,
            columns: result.columns,
          })}
        </p>
        <button
          type="button"
          onClick={() => setShowSql((v) => !v)}
          className="mt-3 text-xs font-medium text-ink-faint transition hover:text-ink-muted"
        >
          {showSql ? 'Hide SQL' : 'Show SQL'}
        </button>
        {showSql && (
          <div className="mt-2 space-y-4">
            <pre className="overflow-x-auto rounded-xl border border-line bg-panel p-3 text-xs text-ink-muted">
              {result.sql}
            </pre>
            {displayRows.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-line bg-panel shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-line bg-card">
                      {result.columns.map((col) => (
                        <th
                          key={col}
                          className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-ink-muted"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayRows.map((row, i) => (
                      <tr key={i} className="border-b border-line/60 last:border-b-0">
                        {result.columns.map((col) => (
                          <td key={col} className="px-4 py-2.5 tabular-nums text-ink">
                            {formatCell(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {hiddenCount > 0 && (
                  <div className="border-t border-line px-4 py-2 text-xs text-ink-faint">
                    …and {hiddenCount} more row{hiddenCount === 1 ? '' : 's'}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {result.playerLinks.length > 0 && (
        <div>
          <div className="mb-3 text-xs font-medium uppercase tracking-widest text-ink-faint">
            Shot charts
          </div>
          <div
            className={`grid gap-3 ${result.playerLinks.length > 1 ? 'sm:grid-cols-2' : ''}`}
          >
            {result.playerLinks.map((player) => (
              <PlayerLinkCard
                key={player.personId}
                personId={player.personId}
                name={player.name}
                teamAbbreviation={player.teamAbbreviation}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
