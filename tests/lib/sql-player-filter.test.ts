import { describe, expect, it } from 'vitest';
import { extractPlayerNameFilterGroups } from '@/lib/sql/playerFilter';

describe('extractPlayerNameFilterGroups', () => {
  it('extracts a single ILIKE pattern', () => {
    const sql = `
      SELECT period, COUNT(*) AS attempts
      FROM nba_shots s
      JOIN nba_players p ON p.person_id = s.person_id
      WHERE p.display_first_last ILIKE '%harden%'
        AND s.season_type = 'Regular Season'
      GROUP BY period
      LIMIT 50
    `;
    expect(extractPlayerNameFilterGroups(sql)).toEqual([['%harden%']]);
  });

  it('ANDs multiple ILIKE patterns in one OR branch', () => {
    const sql = `
      SELECT COUNT(*) FROM nba_shots s
      JOIN nba_players p ON p.person_id = s.person_id
      WHERE p.display_first_last ILIKE '%steph%'
        AND p.display_first_last ILIKE '%curry%'
      LIMIT 50
    `;
    expect(extractPlayerNameFilterGroups(sql)).toEqual([['%steph%', '%curry%']]);
  });

  it('splits OR branches for multi-player queries', () => {
    const sql = `
      SELECT p.person_id, s.shot_zone_basic, COUNT(*) AS attempts
      FROM nba_shots s
      JOIN nba_players p ON p.person_id = s.person_id
      WHERE p.display_first_last ILIKE '%doncic%' OR p.display_first_last ILIKE '%jokic%'
      GROUP BY p.person_id, s.shot_zone_basic
      LIMIT 50
    `;
    expect(extractPlayerNameFilterGroups(sql)).toEqual([['%doncic%'], ['%jokic%']]);
  });

  it('returns empty when no name filters are present', () => {
    const sql = `
      SELECT p.person_id, st.pts
      FROM nba_player_stats st
      JOIN nba_players p ON p.person_id = st.person_id
      WHERE st.team_abbreviation = 'TOR'
      LIMIT 5
    `;
    expect(extractPlayerNameFilterGroups(sql)).toEqual([]);
  });
});
