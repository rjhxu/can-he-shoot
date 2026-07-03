'use client';

import type { SeasonType } from '@/lib/nba/types';

const OPTIONS: { value: SeasonType; label: string }[] = [
  { value: 'Regular Season', label: 'Regular Season' },
  { value: 'Playoffs', label: 'Playoffs' },
];

interface Props {
  value: SeasonType;
  onChange: (v: SeasonType) => void;
}

export default function SeasonTypeToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 text-xs sm:text-sm dark:border-white/10 dark:bg-slate-900/60">
      {OPTIONS.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-md px-3 py-1.5 transition ${
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
