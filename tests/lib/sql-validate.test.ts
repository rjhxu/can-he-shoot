import { describe, expect, it } from 'vitest';
import { validateSql } from '@/lib/sql/validate';

describe('validateSql', () => {
  it('accepts a valid SELECT', () => {
    const sql =
      "SELECT p.display_first_last, st.pts FROM nba_player_stats st JOIN nba_players p ON p.person_id = st.person_id WHERE p.display_first_last ILIKE '%lebron%' LIMIT 5";
    expect(validateSql(sql)).toBe(sql);
  });

  it('appends LIMIT 200 when missing', () => {
    const sql = 'SELECT * FROM nba_players';
    expect(validateSql(sql)).toBe('SELECT * FROM nba_players LIMIT 200');
  });

  it('rejects non-SELECT statements', () => {
    expect(() => validateSql('INSERT INTO nba_players VALUES (1)')).toThrow(
      'Only SELECT statements are allowed',
    );
  });

  it('rejects disallowed keywords', () => {
    expect(() => validateSql('SELECT * FROM nba_players; DROP TABLE nba_players')).toThrow(
      'disallowed keyword',
    );
    expect(() => validateSql('SELECT * FROM nba_players -- comment')).toThrow(
      'disallowed keyword',
    );
  });

  it('rejects unknown tables', () => {
    expect(() => validateSql('SELECT * FROM users LIMIT 1')).toThrow('Table not allowed');
  });
});
