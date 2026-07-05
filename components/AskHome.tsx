'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import AskForm from '@/components/AskForm';
import AskResults, { type AskResponse } from '@/components/AskResults';
import ExampleChips from '@/components/ExampleChips';

export default function AskHome() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AskResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const submitQuestion = useCallback(async (question: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
        signal: controller.signal,
      });

      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? 'Something went wrong. Please try again.');
        return;
      }

      setResult(body as AskResponse);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError('Network error — check your connection and try again.');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col items-center gap-10 px-4 pb-20 pt-14 sm:px-6 sm:pt-24">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="rounded-full border border-line bg-panel px-3 py-1 text-xs font-medium uppercase tracking-widest text-ink-muted">
          2025–26 NBA · Plain-English answers
        </span>
        <h1 className="font-display text-5xl font-bold uppercase leading-[0.95] tracking-wide text-ink sm:text-7xl">
          Ask anything about
          <br />
          <span className="text-accent">NBA shooting</span>
        </h1>
        <p className="max-w-md text-base text-ink-muted">
          StatMuse-style answers built from live shot and season data — then
          jump straight to the shot chart.
        </p>
      </div>

      <div className="flex w-full flex-col items-center gap-5">
        <AskForm onSubmit={submitQuestion} loading={loading} />
        <ExampleChips onSelect={submitQuestion} disabled={loading} />
      </div>

      <AskResults result={result} loading={loading} error={error} />
    </main>
  );
}
