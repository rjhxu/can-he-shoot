import { describe, expect, it } from 'vitest';
import {
  buildPlayerNameLookupSql,
  extractPlayerNameTokens,
  getUnsupportedQuestionMessage,
  hasHallucinatedOpponentFilter,
  isOpponentQuestion,
} from '@/lib/ask/unsupportedQuestion';

describe('isOpponentQuestion', () => {
  it('detects against-the-team questions', () => {
    expect(isOpponentQuestion('How did LeBron shoot against the Celtics?')).toBe(true);
  });

  it('allows player-vs-player comparisons', () => {
    expect(isOpponentQuestion('How did Luka and Jokic compare in shot selection by zone?')).toBe(
      false,
    );
  });

  it('allows team roster questions', () => {
    expect(isOpponentQuestion('Who shot the best on the Raptors?')).toBe(false);
  });
});

describe('getUnsupportedQuestionMessage', () => {
  it('returns a helpful message for matchup questions', () => {
    expect(getUnsupportedQuestionMessage('How did LeBron shoot against the Celtics?')).toContain(
      "can't answer matchup questions",
    );
  });
});

describe('hasHallucinatedOpponentFilter', () => {
  it('flags team names in shot_zone_basic', () => {
    const sql =
      "SELECT 1 FROM nba_shots s WHERE s.shot_zone_basic = 'Boston Celtics' LIMIT 1";
    expect(hasHallucinatedOpponentFilter(sql)).toBe(true);
  });

  it('allows valid court zones', () => {
    const sql =
      "SELECT 1 FROM nba_shots s WHERE s.shot_zone_basic IN ('Left Corner 3', 'Right Corner 3') LIMIT 1";
    expect(hasHallucinatedOpponentFilter(sql)).toBe(false);
  });
});

describe('extractPlayerNameTokens', () => {
  it('keeps player tokens and drops team words', () => {
    expect(extractPlayerNameTokens('How did LeBron shoot against the Celtics?')).toEqual([
      'lebron',
    ]);
  });
});

describe('buildPlayerNameLookupSql', () => {
  it('builds ILIKE filters for player lookup', () => {
    expect(buildPlayerNameLookupSql('How did LeBron shoot against the Celtics?')).toContain(
      "ILIKE '%lebron%'",
    );
  });
});
