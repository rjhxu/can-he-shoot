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
    <div className="flex flex-wrap justify-center gap-2">
      {EXAMPLE_QUESTIONS.map((q) => (
        <button
          key={q}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(q)}
          className="rounded-full border border-line bg-card px-3.5 py-1.5 text-left text-xs font-medium text-ink-muted transition hover:border-accent/50 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          {q}
        </button>
      ))}
    </div>
  );
}
