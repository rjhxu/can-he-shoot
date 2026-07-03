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
        <div className="h-8 w-3/4 animate-pulse rounded-lg bg-slate-800/80" />
        <div className="h-4 w-full animate-pulse rounded bg-slate-800/60 court-skeleton-legend" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-slate-800/60 court-skeleton-legend" />
        <div className="mt-6 h-48 animate-pulse rounded-xl bg-slate-900/50" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-2xl rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
        <div className="font-semibold">Couldn&apos;t answer that question.</div>
        <div className="mt-1 text-rose-200/80">{error}</div>
      </div>
    );
  }

  if (!result) return null;

  const displayRows = result.rows.slice(0, MAX_DISPLAY_ROWS);
  const hiddenCount = result.rows.length - displayRows.length;

  return (
    <div className="w-full max-w-3xl space-y-6">
      <p className="text-2xl font-semibold leading-snug text-white">{result.answer}</p>

      <div>
        <button
          type="button"
          onClick={() => setShowSql((v) => !v)}
          className="text-xs text-slate-500 hover:text-slate-400"
        >
          {showSql ? 'Hide SQL' : 'Show SQL'}
        </button>
        {showSql && (
          <pre className="mt-2 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-400">
            {result.sql}
          </pre>
        )}
      </div>

      {displayRows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-800/80">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60">
                {result.columns.map((col) => (
                  <th key={col} className="px-4 py-2.5 font-medium text-slate-400">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, i) => (
                <tr
                  key={i}
                  className={i % 2 === 0 ? 'bg-slate-900/20' : 'bg-transparent'}
                >
                  {result.columns.map((col) => (
                    <td key={col} className="px-4 py-2 text-slate-200">
                      {formatCell(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {hiddenCount > 0 && (
            <div className="border-t border-slate-800 px-4 py-2 text-xs text-slate-500">
              …and {hiddenCount} more row{hiddenCount === 1 ? '' : 's'}
            </div>
          )}
        </div>
      )}

      {result.playerLinks.length === 1 && (
        <Link
          href={`/players/${result.playerLinks[0].personId}`}
          className="inline-flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm font-medium text-sky-200 transition hover:bg-sky-500/20"
        >
          View {result.playerLinks[0].name}&apos;s full shot chart →
        </Link>
      )}
    </div>
  );
}
