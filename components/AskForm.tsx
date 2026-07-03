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
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about any player's shooting — e.g. 'Does Steph shoot better in the 4th quarter?'"
          disabled={loading}
          className="flex-1 rounded-xl border border-slate-700/60 bg-slate-900/50 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/30 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || question.trim().length < 3}
          className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Ask
        </button>
      </div>
    </form>
  );
}
