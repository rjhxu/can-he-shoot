'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import AskForm from '@/components/AskForm';
import AskResults, { type AskResponse } from '@/components/AskResults';
import ExampleChips from '@/components/ExampleChips';
import SiteHeader from '@/components/SiteHeader';

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
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 p-6 sm:p-8">
      <SiteHeader />

      <div className="flex flex-1 flex-col items-center gap-8 pt-8 sm:pt-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Ask anything about NBA shooting
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Plain-English questions, StatMuse-style answers — powered by your
            shot and season data.
          </p>
        </div>

        <AskForm onSubmit={submitQuestion} loading={loading} />
        <ExampleChips onSelect={submitQuestion} disabled={loading} />
        <AskResults result={result} loading={loading} error={error} />
      </div>
    </main>
  );
}
