'use client';

export const EXAMPLE_QUESTIONS = [
  'How many points does LeBron average this season?',
  "What's Steph Curry's 3PT% from the corner?",
  'Which player has the best free throw percentage?',
  "Compare Luka and Jokic's shot selection by zone",
  'Does Stephen Curry shoot better in the 4th quarter?',
  'How does LeBron shoot against the Celtics?',
] as const;

interface Props {
  onSelect: (question: string) => void;
  disabled?: boolean;
}

export default function ExampleChips({ onSelect, disabled }: Props) {
  return (
    <div className="flex max-w-2xl flex-wrap justify-center gap-2">
      {EXAMPLE_QUESTIONS.map((q) => (
        <button
          key={q}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(q)}
          className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-left text-xs text-slate-600 transition hover:border-sky-500/40 hover:bg-sky-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-slate-300 dark:hover:border-sky-500/40 dark:hover:bg-slate-800/60 dark:hover:text-white"
        >
          {q}
        </button>
      ))}
    </div>
  );
}
