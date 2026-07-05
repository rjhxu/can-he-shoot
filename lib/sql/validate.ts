const FORBIDDEN =
  /\b(insert|update|delete|drop|alter|grant|revoke|truncate|create)\b|--|;|\/\*/i;

const ALLOWED_TABLES = ['nba_players', 'nba_shots', 'nba_player_stats'];

export function validateSql(rawSql: string): string {
  const sql = rawSql.trim();
  if (!/^select/i.test(sql)) {
    throw new Error('Only SELECT statements are allowed');
  }
  if (FORBIDDEN.test(sql)) {
    throw new Error('Query contains a disallowed keyword');
  }

  const tableRefs = [...sql.matchAll(/\b(?:from|join)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi)].map(
    (m) => m[1].toLowerCase(),
  );
  for (const t of tableRefs) {
    if (!ALLOWED_TABLES.includes(t)) {
      throw new Error(`Table not allowed: ${t}`);
    }
  }

  return /\blimit\s+\d+/i.test(sql) ? sql : `${sql} LIMIT 200`;
}
