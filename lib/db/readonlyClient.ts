import { Pool, type QueryResultRow } from 'pg';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const url = process.env.ASK_READONLY_DATABASE_URL;
    if (!url) {
      throw new Error('Missing required environment variable: ASK_READONLY_DATABASE_URL');
    }
    pool = new Pool({
      connectionString: url,
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export interface ReadonlyQueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
}

export async function queryReadonly(sql: string): Promise<ReadonlyQueryResult> {
  const client = await getPool().connect();
  try {
    const result = await client.query<QueryResultRow>(sql);
    const columns = result.fields.map((f) => f.name);
    const rows = result.rows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const col of columns) {
        out[col] = row[col];
      }
      return out;
    });
    return { columns, rows };
  } finally {
    client.release();
  }
}

export function isDbTimeoutError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('statement timeout') ||
    msg.includes('canceling statement') ||
    msg.includes('query read timeout')
  );
}
