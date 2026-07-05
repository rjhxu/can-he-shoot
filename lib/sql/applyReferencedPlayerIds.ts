import { extractPlayerNameFilterGroups } from '@/lib/sql/playerFilter';
import {
  findMainWhereClause,
  findTopLevelKeyword,
  WHERE_TERMINATOR,
} from '@/lib/sql/whereClause';

const NAME_ILIKE =
  /(?:p\.)?(?:display_first_last|player_name)\s+ILIKE\s+'[^']+'/i;
const NAME_ONLY_GROUP =
  /^\(\s*(?:(?:p\.)?(?:display_first_last|player_name)\s+ILIKE\s+'[^']+'\s*(?:AND|OR)\s*)+(?:p\.)?(?:display_first_last|player_name)\s+ILIKE\s+'[^']+'\s*\)$/i;

/** Strip player-name ILIKE predicates, leaving other WHERE conditions intact. */
export function removePlayerNameFilters(whereClause: string): string {
  let clause = whereClause.trim();
  if (!clause) return '';

  let prev = '';
  while (clause !== prev) {
    prev = clause;
    clause = clause.replace(NAME_ONLY_GROUP, '');
  }

  while (NAME_ILIKE.test(clause)) {
    clause = clause
      .replace(/\s+AND\s+(?:p\.)?(?:display_first_last|player_name)\s+ILIKE\s+'[^']+'/i, '')
      .replace(/\s+OR\s+(?:p\.)?(?:display_first_last|player_name)\s+ILIKE\s+'[^']+'/i, '')
      .replace(/(?:p\.)?(?:display_first_last|player_name)\s+ILIKE\s+'[^']+'\s+AND\s+/i, '')
      .replace(/(?:p\.)?(?:display_first_last|player_name)\s+ILIKE\s+'[^']+'\s+OR\s+/i, '')
      .replace(/(?:p\.)?(?:display_first_last|player_name)\s+ILIKE\s+'[^']+'/i, '');
  }

  return clause
    .replace(/\(\s*\)/g, '')
    .replace(/^\s*(?:AND|OR)\s+/i, '')
    .replace(/\s+(?:AND|OR)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Replace fragile name ILIKE filters with p.person_id IN (...) when Cohere
 * supplies known player IDs. Fixes accented names (e.g. Dončić vs doncic).
 */
export function applyReferencedPlayerIds(sql: string, personIds: number[]): string {
  const ids = [...new Set(personIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) return sql;
  if (extractPlayerNameFilterGroups(sql).length === 0) return sql;

  const idList = ids.sort((a, b) => a - b).join(', ');
  const personIdPredicate = `p.person_id IN (${idList})`;

  const whereMatch = findMainWhereClause(sql);
  if (!whereMatch) {
    const from = findTopLevelKeyword(sql, 'from');
    const insertPoint = from
      ? sql.slice(from.index + from.length).search(WHERE_TERMINATOR)
      : sql.search(WHERE_TERMINATOR);
    if (insertPoint === -1) return `${sql.trim()} WHERE ${personIdPredicate}`;
    const absoluteInsert = from
      ? from.index + from.length + insertPoint
      : insertPoint;
    return `${sql.slice(0, absoluteInsert).trimEnd()} WHERE ${personIdPredicate} ${sql.slice(absoluteInsert).trimStart()}`;
  }

  const beforeWhere = sql.slice(0, whereMatch.index + whereMatch.length);
  const afterWhere = sql.slice(whereMatch.index + whereMatch.length);
  const terminator = afterWhere.search(WHERE_TERMINATOR);
  const whereClause = (terminator === -1 ? afterWhere : afterWhere.slice(0, terminator)).trim();
  const afterWhereClause = terminator === -1 ? '' : afterWhere.slice(terminator);

  const remaining = removePlayerNameFilters(whereClause);
  const newWhere = remaining
    ? `${personIdPredicate} AND (${remaining})`
    : personIdPredicate;

  return `${beforeWhere} ${newWhere}${afterWhereClause ? ` ${afterWhereClause.trimStart()}` : ''}`;
}
