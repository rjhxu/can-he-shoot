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
          className="rounded-full border border-slate-700/60 bg-slate-900/40 px-3 py-1.5 text-left text-xs text-slate-300 transition hover:border-sky-500/40 hover:bg-slate-800/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {q}
        </button>
      ))}
    </div>
  );
}
