import { extractMainWhereClause } from '@/lib/sql/whereClause';

const NAME_ILIKE =
  /(?:display_first_last|player_name)\s+ILIKE\s+'([^']+)'/gi;

/** Split a WHERE clause on top-level OR (ignores OR inside parentheses). */
function splitOrSegments(whereClause: string): string[] {
  const segments: string[] = [];
  let depth = 0;
  let start = 0;
  const lower = whereClause.toLowerCase();

  for (let i = 0; i < whereClause.length; i += 1) {
    const char = whereClause[i];
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;

    if (depth === 0 && lower.slice(i, i + 4) === ' or ') {
      segments.push(whereClause.slice(start, i).trim());
      start = i + 4;
    }
  }

  segments.push(whereClause.slice(start).trim());
  return segments.filter(Boolean);
}

function extractIlikePatterns(segment: string): string[] {
  const patterns: string[] = [];
  const re = new RegExp(NAME_ILIKE.source, 'gi');
  let match = re.exec(segment);
  while (match) {
    patterns.push(match[1]);
    match = re.exec(segment);
  }
  return patterns;
}

/**
 * Player name ILIKE patterns grouped by OR branch. Patterns within a group are ANDed.
 * e.g. `%harden%` -> [['%harden%']]; `%steph%` AND `%curry%` -> [['%steph%','%curry%']];
 * `%doncic%` OR `%jokic%` -> [['%doncic%'], ['%jokic%']].
 */
export function extractPlayerNameFilterGroups(sql: string): string[][] {
  const whereClause = extractMainWhereClause(sql);
  if (!whereClause) return [];

  return splitOrSegments(whereClause)
    .map(extractIlikePatterns)
    .filter((group) => group.length > 0);
}
