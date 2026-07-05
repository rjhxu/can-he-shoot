'use client';

import type { SeasonType } from '@/lib/nba/types';

const OPTIONS: { value: SeasonType; label: string }[] = [
  { value: 'Regular Season', label: 'Regular Season' },
  { value: 'Playoffs', label: 'Playoffs' },
];

interface Props {
  value: SeasonType;
  onChange: (v: SeasonType) => void;
  className?: string;
  ariaLabel?: string;
}

export default function SeasonTypeToggle({
  value,
  onChange,
  className = '',
  ariaLabel = 'Season type',
}: Props) {
  return (
    <div
      className={`inline-flex rounded-full border border-line bg-panel p-1 text-xs sm:text-sm ${className}`}
      aria-label={ariaLabel}
    >
      {OPTIONS.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-full px-3 py-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 ${
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
