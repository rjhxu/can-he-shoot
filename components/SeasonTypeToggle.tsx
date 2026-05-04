'use client';

import type { SeasonType } from '@/lib/nba/types';

const OPTIONS: { value: SeasonType; label: string }[] = [
  { value: 'Regular Season', label: 'Regular Season' },
  { value: 'Playoffs', label: 'Playoffs' },
  { value: 'Career', label: 'Career' },
];

interface Props {
  value: SeasonType;
  onChange: (v: SeasonType) => void;
}

export default function SeasonTypeToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex rounded-lg border border-white/10 bg-slate-900/60 p-1 text-sm">
      {OPTIONS.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-md px-3 py-1.5 transition ${
              active
                ? 'bg-white text-slate-900 font-medium'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
