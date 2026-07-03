'use client';

import { Command } from 'cmdk';
import { useEffect, useRef, useState } from 'react';
import type { Player } from '@/lib/nba/types';

interface Props {
  players: Player[];
  selected: Player | null;
  onSelect: (p: Player) => void;
}

export default function PlayerSearch({ players, selected, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={containerRef} className="relative z-30 w-full max-w-xl">
      <Command
        label="Search active NBA players"
        shouldFilter
        filter={(value, search) => {
          if (!search) return 1;
          return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
        }}
        className="rounded-xl border border-slate-200 bg-white shadow-lg dark:border-white/10 dark:bg-slate-900/80 dark:backdrop-blur"
      >
        <div className="flex items-center gap-2 px-4 py-3">
          <SearchIcon />
          <Command.Input
            value={query}
            onValueChange={setQuery}
            onFocus={() => setOpen(true)}
            placeholder={
              selected
                ? `${selected.fullName} · ${selected.teamAbbreviation}`
                : 'Search any active NBA player…'
            }
            className="w-full bg-transparent text-base text-slate-900 placeholder:text-slate-400 outline-none dark:text-white dark:placeholder:text-slate-400"
          />
          {selected && (
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-white/10 dark:text-slate-200">
              {selected.teamAbbreviation}
            </span>
          )}
        </div>

        {open && (
          <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900/95 dark:backdrop-blur">
            <Command.List className="max-h-80 overflow-y-auto p-1">
              <Command.Empty className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                No players match.
              </Command.Empty>
              {players.map((p) => (
                <Command.Item
                  key={p.personId}
                  value={`${p.fullName} ${p.teamAbbreviation}`}
                  onSelect={() => {
                    onSelect(p);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-slate-800 aria-selected:bg-slate-100 dark:text-slate-100 dark:aria-selected:bg-white/10"
                >
                  <span className="truncate">{p.fullName}</span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-white/5 dark:text-slate-300">
                    {p.teamAbbreviation || '—'}
                  </span>
                </Command.Item>
              ))}
            </Command.List>
          </div>
        )}
      </Command>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-slate-400"
    >
      <circle cx={11} cy={11} r={7} />
      <path d="m20 20-3-3" />
    </svg>
  );
}
