import { describe, expect, it } from 'vitest';
import {
  extractMainWhereClause,
  findMainWhereClause,
  findTopLevelKeyword,
} from '@/lib/sql/whereClause';

describe('findMainWhereClause', () => {
  it('finds WHERE after FROM, not FILTER (WHERE ...)', () => {
    const sql = `
      SELECT COUNT(*) FILTER (WHERE shot_made_flag=1) AS makes
      FROM nba_shots s
      WHERE s.season_type = 'Regular Season'
      LIMIT 50
    `;
    const where = findMainWhereClause(sql);
    expect(where).not.toBeNull();
    expect(sql.slice(where!.index, where!.index + 20).toLowerCase()).toContain(
      "where s.season_type",
    );
  });

  it('extractMainWhereClause returns only the main predicate', () => {
    const sql = `
      SELECT COUNT(*) FILTER (WHERE shot_made_flag=1) AS makes
      FROM nba_shots s
      WHERE s.season_type = 'Regular Season'
      GROUP BY s.person_id
    `;
    expect(extractMainWhereClause(sql)).toBe("s.season_type = 'Regular Season'");
  });
});

describe('findTopLevelKeyword', () => {
  it('skips keywords inside parentheses', () => {
    const sql = 'SELECT x FROM t WHERE id IN (SELECT 1 FROM u WHERE active = true)';
    const fromInside = findTopLevelKeyword(sql, 'from', 0);
    expect(fromInside?.index).toBe(sql.toLowerCase().indexOf('from t'));
  });
});
