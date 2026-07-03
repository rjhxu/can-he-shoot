'use client';

import Link from 'next/link';
import { useState } from 'react';

export interface AskResponse {
  question: string;
  sql: string;
  columns: string[];
  rows: Record<string, unknown>[];
  answer: string;
  playerLinks: { personId: number; name: string }[];
}

const MAX_DISPLAY_ROWS = 50;

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, '');
  }
  return String(value);
}

function PlayerLinkCard({ personId, name }: { personId: number; name: string }) {
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
      className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-sky-500/30 hover:bg-slate-50 sm:p-4 dark:border-slate-800/80 dark:bg-slate-900/50 dark:shadow-none dark:hover:bg-slate-900/80"
    >
      <div className="h-16 w-[4.4rem] shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10">
        {errored ? (
          <div
            className="flex h-full w-full items-center justify-center bg-slate-200 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
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
        <div className="truncate font-semibold text-slate-900 dark:text-white">{name}</div>
        <div className="mt-0.5 text-sm font-medium text-sky-600 transition group-hover:text-sky-500 dark:text-sky-300 dark:group-hover:text-sky-200">
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
      <div className="w-full max-w-3xl space-y-4">
        <div className="h-8 w-3/4 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800/80" />
        <div className="h-4 w-full animate-pulse rounded bg-slate-200 court-skeleton-legend dark:bg-slate-800/60" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-slate-200 court-skeleton-legend dark:bg-slate-800/60" />
        <div className="mt-6 h-48 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-900/50" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-2xl rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
        <div className="font-semibold">Couldn&apos;t answer that question.</div>
        <div className="mt-1 text-rose-700 dark:text-rose-200/80">{error}</div>
      </div>
    );
  }

  if (!result) return null;

  const displayRows = result.rows.slice(0, MAX_DISPLAY_ROWS);
  const hiddenCount = result.rows.length - displayRows.length;

  return (
    <div className="w-full max-w-3xl space-y-6">
      <p className="text-2xl font-semibold leading-snug text-slate-900 dark:text-white">{result.answer}</p>

      <div>
        <button
          type="button"
          onClick={() => setShowSql((v) => !v)}
          className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-400"
        >
          {showSql ? 'Hide SQL' : 'Show SQL'}
        </button>
        {showSql && (
          <pre className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-400">
            {result.sql}
          </pre>
        )}
      </div>

      {displayRows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800/80">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60">
                {result.columns.map((col) => (
                  <th key={col} className="px-4 py-2.5 font-medium text-slate-500 dark:text-slate-400">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, i) => (
                <tr
                  key={i}
                  className={i % 2 === 0 ? 'bg-slate-50 dark:bg-slate-900/20' : 'bg-transparent'}
                >
                  {result.columns.map((col) => (
                    <td key={col} className="px-4 py-2 text-slate-700 dark:text-slate-200">
                      {formatCell(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {hiddenCount > 0 && (
            <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-800">
              …and {hiddenCount} more row{hiddenCount === 1 ? '' : 's'}
            </div>
          )}
        </div>
      )}

      {result.playerLinks.length > 0 && (
        <div
          className={`grid gap-3 ${result.playerLinks.length > 1 ? 'sm:grid-cols-2' : ''}`}
        >
          {result.playerLinks.map((player) => (
            <PlayerLinkCard
              key={player.personId}
              personId={player.personId}
              name={player.name}
            />
          ))}
        </div>
      )}
    </div>
  );
}
