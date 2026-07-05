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
    ? 'rounded-full border border-line bg-panel p-0.5 text-[10px]'
    : 'rounded-full border border-line bg-panel p-1 text-xs sm:text-sm';
  const buttonPad = compact ? 'rounded-full px-2 py-0.5' : 'rounded-full px-3 py-1.5';

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
            className={`${buttonPad} transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 ${
              active
                ? 'bg-ink font-medium text-paper shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
