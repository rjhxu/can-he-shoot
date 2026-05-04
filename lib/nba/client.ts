import type { NbaApiResponse, NbaApiTable } from './types';

const NBA_HEADERS: Record<string, string> = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Connection: 'keep-alive',
  Host: 'stats.nba.com',
  Origin: 'https://www.nba.com',
  Referer: 'https://www.nba.com/',
  'Sec-Ch-Ua':
    '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"macOS"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-site',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
};

const NBA_BASE = 'https://stats.nba.com/stats';
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 1;
const BACKOFF_MS = 500;

export class NbaApiError extends Error {
  status: number;
  url: string;
  constructor(message: string, status: number, url: string) {
    super(message);
    this.status = status;
    this.url = url;
    this.name = 'NbaApiError';
  }
}

interface NbaFetchOptions {
  /** Seconds for Next.js ISR `next.revalidate`. */
  revalidate?: number;
  /** Override default 10s timeout. */
  timeoutMs?: number;
  /** Cache tags for selective revalidation. */
  tags?: string[];
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wrapper around fetch for stats.nba.com that adds the headers the API
 * requires, applies a timeout, retries once on 429/5xx, and surfaces
 * Akamai-style block status codes clearly.
 */
export async function nbaFetch(
  url: string,
  options: NbaFetchOptions = {},
): Promise<Response> {
  const { revalidate, timeoutMs = DEFAULT_TIMEOUT_MS, tags } = options;

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: NBA_HEADERS,
        signal: controller.signal,
        next: revalidate !== undefined ? { revalidate, tags } : undefined,
      });

      if (res.ok) {
        return res;
      }

      const retryable = res.status === 429 || res.status >= 500;
      console.warn(
        `[nbaFetch] ${res.status} ${res.statusText} on ${url}` +
          (retryable && attempt < MAX_RETRIES ? ' — retrying' : ''),
      );

      if (!retryable || attempt === MAX_RETRIES) {
        throw new NbaApiError(
          `NBA stats request failed: ${res.status} ${res.statusText}`,
          res.status,
          url,
        );
      }
    } catch (err) {
      lastError = err;
      if (err instanceof NbaApiError) throw err;
      if (attempt === MAX_RETRIES) {
        const isAbort = err instanceof Error && err.name === 'AbortError';
        throw new NbaApiError(
          isAbort
            ? `NBA stats request timed out after ${timeoutMs}ms`
            : `NBA stats fetch failed: ${(err as Error).message ?? String(err)}`,
          isAbort ? 504 : 502,
          url,
        );
      }
    } finally {
      clearTimeout(timeout);
    }

    await sleep(BACKOFF_MS * (attempt + 1));
  }

  throw new NbaApiError(
    `NBA stats request failed: ${(lastError as Error)?.message ?? 'unknown'}`,
    502,
    url,
  );
}

/** Build a `stats.nba.com/stats/<endpoint>?...` URL with sorted params. */
export function nbaUrl(
  endpoint: string,
  params: Record<string, string | number>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    search.set(key, String(value));
  }
  return `${NBA_BASE}/${endpoint}?${search.toString()}`;
}

/**
 * Convert an NBA stats `resultSets` table into an array of typed objects
 * keyed by header name. Returns `[]` for unknown table names.
 */
export function tableToObjects<T>(
  payload: NbaApiResponse,
  tableName: string,
  map: (row: Record<string, unknown>) => T,
): T[] {
  const table: NbaApiTable | undefined = payload.resultSets.find(
    (t) => t.name === tableName,
  );
  if (!table) return [];
  return table.rowSet.map((row) => {
    const obj: Record<string, unknown> = {};
    table.headers.forEach((h, i) => {
      obj[h] = row[i];
    });
    return map(obj);
  });
}
