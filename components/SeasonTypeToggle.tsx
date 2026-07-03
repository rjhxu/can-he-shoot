'use client';

import type { SeasonType } from '@/lib/nba/types';

const FULL_OPTIONS: { value: SeasonType; label: string }[] = [
  { value: 'Regular Season', label: 'Regular Season' },
  { value: 'Playoffs', label: 'Playoffs' },
];

const COMPACT_OPTIONS: { value: SeasonType; label: string }[] = [
  { value: 'Regular Season', label: 'RS' },
  { value: 'Playoffs', label: 'PO' },
];

interface Props {
  value: SeasonType;
  onChange: (v: SeasonType) => void;
  /** Short RS/PO labels instead of full season names. */
  compact?: boolean;
  /** When false, render nothing (e.g. player has no playoff stats). */
  visible?: boolean;
  className?: string;
  ariaLabel?: string;
}

export default function SeasonTypeToggle({
  value,
  onChange,
  compact = false,
  visible = true,
  className = '',
  ariaLabel = 'Season type',
}: Props) {
  if (!visible) return null;

  const options = compact ? COMPACT_OPTIONS : FULL_OPTIONS;
  const sizeClass = compact
    ? 'rounded-md border border-slate-200 bg-slate-100 p-0.5 text-[10px] dark:border-white/10 dark:bg-slate-900/60'
    : 'rounded-lg border border-slate-200 bg-slate-100 p-1 text-xs sm:text-sm dark:border-white/10 dark:bg-slate-900/60';
  const buttonPad = compact ? 'rounded px-2 py-0.5' : 'rounded-md px-3 py-1.5';

  return (
    <div
      className={`inline-flex ${sizeClass} ${className}`}
      role={compact ? 'tablist' : undefined}
      aria-label={ariaLabel}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role={compact ? 'tab' : undefined}
            aria-selected={compact ? active : undefined}
            onClick={() => onChange(o.value)}
            className={`${buttonPad} transition ${
              active
                ? 'bg-white font-medium text-slate-900 shadow-sm dark:bg-white dark:text-slate-900'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
