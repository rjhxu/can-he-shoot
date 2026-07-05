import { describe, expect, it } from 'vitest';
import {
  applyReferencedPlayerIds,
  removePlayerNameFilters,
} from '@/lib/sql/applyReferencedPlayerIds';

describe('removePlayerNameFilters', () => {
  it('removes a single ILIKE predicate', () => {
    expect(removePlayerNameFilters("p.display_first_last ILIKE '%harden%'")).toBe('');
  });

  it('removes OR branches for multi-player queries', () => {
    const where =
      "(p.display_first_last ILIKE '%luka%' AND p.display_first_last ILIKE '%doncic%') OR (p.display_first_last ILIKE '%jokic%')";
    expect(removePlayerNameFilters(where)).toBe('');
  });

  it('keeps non-name conditions', () => {
    const where =
      "p.display_first_last ILIKE '%doncic%' OR p.display_first_last ILIKE '%jokic%' AND s.season_type = 'Regular Season'";
    expect(removePlayerNameFilters(where)).toBe("s.season_type = 'Regular Season'");
  });
});

describe('applyReferencedPlayerIds', () => {
  it('rewrites Luka vs Jokic zone comparison to person_id IN', () => {
    const sql = `
      SELECT p.person_id, p.display_first_last, s.shot_zone_basic, COUNT(*) AS attempts
      FROM nba_shots s
      JOIN nba_players p ON p.person_id = s.person_id
      WHERE (p.display_first_last ILIKE '%luka%' AND p.display_first_last ILIKE '%doncic%')
        OR (p.display_first_last ILIKE '%jokic%')
      GROUP BY p.person_id, p.display_first_last, s.shot_zone_basic
      ORDER BY p.display_first_last, attempts DESC
      LIMIT 50
    `;

    const rewritten = applyReferencedPlayerIds(sql, [1629029, 203999]);
    expect(rewritten).toMatch(/p\.person_id IN \(1629029, 203999\)|p\.person_id IN \(203999, 1629029\)/);
    expect(rewritten).not.toMatch(/ILIKE/i);
  });

  it('preserves other WHERE conditions', () => {
    const sql = `
      SELECT p.person_id, s.period, COUNT(*) AS attempts
      FROM nba_shots s
      JOIN nba_players p ON p.person_id = s.person_id
      WHERE p.display_first_last ILIKE '%harden%'
        AND s.season_type = 'Regular Season'
      GROUP BY p.person_id, s.period
      LIMIT 50
    `;

    const rewritten = applyReferencedPlayerIds(sql, [201935]);
    expect(rewritten).toContain('p.person_id IN (201935)');
    expect(rewritten).toContain("s.season_type = 'Regular Season'");
    expect(rewritten).not.toMatch(/ILIKE/i);
  });

  it('leaves SQL unchanged when no referenced IDs are provided', () => {
    const sql =
      "SELECT p.person_id FROM nba_players p WHERE p.display_first_last ILIKE '%jokic%' LIMIT 5";
    expect(applyReferencedPlayerIds(sql, [])).toBe(sql);
  });

  it('leaves SQL unchanged when no name filters are present', () => {
    const sql =
      "SELECT p.person_id, st.pts FROM nba_player_stats st JOIN nba_players p ON p.person_id = st.person_id WHERE st.team_abbreviation = 'TOR' LIMIT 5";
    expect(applyReferencedPlayerIds(sql, [1629029])).toBe(sql);
  });

  it('does not rewrite FILTER (WHERE ...) inside SELECT', () => {
    const sql = `
      SELECT p.person_id, p.display_first_last,
        COUNT(*) FILTER (WHERE shot_made_flag=1)::float / NULLIF(COUNT(*),0) AS corner_3pt_pct
      FROM nba_shots s
      JOIN nba_players p ON p.person_id = s.person_id
      WHERE p.display_first_last ILIKE '%steph%'
        AND p.display_first_last ILIKE '%curry%'
        AND s.shot_zone_basic IN ('Left Corner 3', 'Right Corner 3')
        AND s.season_type = 'Regular Season'
      GROUP BY p.person_id, p.display_first_last
      LIMIT 50
    `;

    const rewritten = applyReferencedPlayerIds(sql, [201939]);
    expect(rewritten).toContain('p.person_id IN (201939)');
    expect(rewritten).toContain("COUNT(*) FILTER (WHERE shot_made_flag=1)");
    expect(rewritten).toContain("s.shot_zone_basic IN ('Left Corner 3', 'Right Corner 3')");
    expect(rewritten).not.toMatch(/ILIKE/i);
  });
});
