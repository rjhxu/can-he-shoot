'use client';

import { FormEvent, useState } from 'react';

interface Props {
  onSubmit: (question: string) => void;
  loading: boolean;
  initialValue?: string;
}

export default function AskForm({ onSubmit, loading, initialValue = '' }: Props) {
  const [question, setQuestion] = useState(initialValue);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = question.trim();
    if (trimmed.length < 3 || loading) return;
    onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-card p-2 shadow-sm transition focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/20">
        <SearchIcon />
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Did Steph shoot better in the 4th quarter?"
          disabled={loading}
          className="min-w-0 flex-1 bg-transparent py-2 text-base text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || question.trim().length < 3}
          className="shrink-0 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-faint disabled:opacity-100"
        >
          {loading ? 'Thinking…' : 'Ask'}
        </button>
      </div>
    </form>
  );
}

function SearchIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="ml-2 shrink-0 text-ink-faint"
      aria-hidden
    >
      <circle cx={11} cy={11} r={7} />
      <path d="m20 20-3-3" />
    </svg>
  );
}
