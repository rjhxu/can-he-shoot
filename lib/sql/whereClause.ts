const WHERE_TERMINATOR = /\b(group\s+by|order\s+by|limit)\b/i;

/** Find a SQL keyword at parenthesis depth 0 (optionally after startIndex). */
export function findTopLevelKeyword(
  sql: string,
  keyword: string,
  startIndex = 0,
): { index: number; length: number } | null {
  const lower = sql.toLowerCase();
  const kw = keyword.toLowerCase();
  let depth = 0;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;

    if (i < startIndex || depth !== 0) continue;

    if (lower.slice(i, i + kw.length) === kw) {
      const beforeOk = i === 0 || !/[a-z0-9_]/i.test(sql[i - 1]!);
      const afterOk =
        i + kw.length >= sql.length || !/[a-z0-9_]/i.test(sql[i + kw.length]!);
      if (beforeOk && afterOk) {
        return { index: i, length: kw.length };
      }
    }
  }

  return null;
}

/** Main query WHERE (after FROM), not FILTER/CASE inner WHERE. */
export function findMainWhereClause(sql: string): { index: number; length: number } | null {
  const from = findTopLevelKeyword(sql, 'from');
  if (!from) return null;
  return findTopLevelKeyword(sql, 'where', from.index + from.length);
}

export function extractMainWhereClause(sql: string): string | null {
  const where = findMainWhereClause(sql);
  if (!where) return null;

  const afterWhere = sql.slice(where.index + where.length);
  const terminator = afterWhere.search(WHERE_TERMINATOR);
  return (terminator === -1 ? afterWhere : afterWhere.slice(0, terminator)).trim();
}

export { WHERE_TERMINATOR };
