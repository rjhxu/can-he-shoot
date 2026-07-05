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
        className="rounded-2xl border border-line bg-card shadow-sm transition focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/20"
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
            className="w-full bg-transparent text-base text-ink placeholder:text-ink-faint outline-none"
          />
          {selected && (
            <span className="rounded-md bg-panel px-2 py-0.5 text-xs font-medium text-ink-muted">
              {selected.teamAbbreviation}
            </span>
          )}
        </div>

        {open && (
          <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-line bg-card shadow-xl">
            <Command.List className="max-h-80 overflow-y-auto p-1">
              <Command.Empty className="px-3 py-6 text-center text-sm text-ink-muted">
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
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm text-ink aria-selected:bg-panel data-[selected=true]:bg-panel hover:bg-panel/80"
                >
                  <span className="truncate">{p.fullName}</span>
                  <span className="rounded bg-panel px-2 py-0.5 text-xs text-ink-muted">
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
      className="text-ink-faint"
    >
      <circle cx={11} cy={11} r={7} />
      <path d="m20 20-3-3" />
    </svg>
  );
}
