import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateSql, summarizeResults } from '@/lib/cohere/client';
import { isDbTimeoutError, queryReadonly } from '@/lib/db/readonlyClient';
import { resolvePlayerLinksForAsk } from '@/lib/nba/players';
import { checkRateLimit } from '@/lib/rateLimit';
import { validateSql } from '@/lib/sql/validate';

export const dynamic = 'force-dynamic';

const ROUTE_TIMEOUT_MS = 15_000;

const bodySchema = z.object({
  question: z.string().trim().min(3).max(500),
});

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return request.headers.get('x-real-ip') ?? 'unknown';
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('ROUTE_TIMEOUT')), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many questions — try again in a few minutes.' },
      {
        status: 429,
        headers: rateCheck.retryAfterSec
          ? { 'Retry-After': String(rateCheck.retryAfterSec) }
          : undefined,
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Question must be between 3 and 500 characters.' },
      { status: 400 },
    );
  }

  const { question } = parsed.data;

  try {
    const result = await withTimeout(handleAsk(question), ROUTE_TIMEOUT_MS);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error && err.message === 'ROUTE_TIMEOUT') {
      return NextResponse.json(
        { error: 'That question took too long. Try narrowing it down.' },
        { status: 504 },
      );
    }

    if (isDbTimeoutError(err)) {
      return NextResponse.json(
        { error: 'That question took too long. Try narrowing it down.' },
        { status: 504 },
      );
    }

    const msg = err instanceof Error ? err.message : '';
    if (
      msg.includes('Only SELECT') ||
      msg.includes('disallowed keyword') ||
      msg.includes('Table not allowed') ||
      msg.includes('validateSql')
    ) {
      console.error('[/api/ask] SQL validation failed:', msg);
      return NextResponse.json(
        { error: "Couldn't run that query safely. Try rephrasing." },
        { status: 400 },
      );
    }

    if (
      msg.includes('Cohere') ||
      msg.includes('COHERE') ||
      msg.includes('Missing required environment variable: COHERE') ||
      msg.includes('did not return a valid SQL')
    ) {
      console.error('[/api/ask] Cohere error:', err);
      return NextResponse.json(
        { error: 'Stats assistant is temporarily unavailable.' },
        { status: 503 },
      );
    }

    console.error('[/api/ask] unexpected error:', err);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}

async function handleAsk(question: string) {
  const { sql: rawSql, referenced_player_ids } = await generateSql(question);

  const sql = validateSql(rawSql);
  console.log('[/api/ask] executing SQL:', sql);

  const { columns, rows } = await queryReadonly(sql);
  const playerLinks = await resolvePlayerLinksForAsk(referenced_player_ids, columns, rows);
  const answer = await summarizeResults(question, rows);

  return {
    question,
    sql,
    columns,
    rows,
    answer,
    playerLinks,
  };
}
