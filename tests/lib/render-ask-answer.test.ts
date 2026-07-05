import { describe, expect, it } from 'vitest';
import {
  extractStatStringsFromRows,
  parseAnswerSegments,
} from '@/lib/renderAskAnswer';

const ctx = {
  playerLinks: [
    { name: 'LeBron James', teamAbbreviation: 'LAL' },
    { name: 'Scottie Barnes', teamAbbreviation: 'TOR' },
  ],
  rows: [{ display_first_last: 'LeBron James', pts: 24.8, fg_pct: 0.482 }],
  columns: ['display_first_last', 'pts', 'fg_pct'],
};

describe('extractStatStringsFromRows', () => {
  it('includes integer, decimal, percentage, and ordinal variants', () => {
    const stats = extractStatStringsFromRows([{ pts: 24.8, fg_pct: 0.482, gp: 70, period: 2 }]);
    expect(stats).toContain('24.8');
    expect(stats).toContain('48.2%');
    expect(stats).toContain('70');
    expect(stats).toContain('2nd');
  });
});

describe('parseAnswerSegments', () => {
  it('colors player names with player segment type', () => {
    const segments = parseAnswerSegments(
      'LeBron James is averaging **24.8** points per game.',
      ctx,
    );
    expect(segments).toEqual([
      { type: 'player', text: 'LeBron James', teamAbbreviation: 'LAL' },
      { type: 'text', text: ' is averaging ' },
      { type: 'stat', text: '24.8' },
      { type: 'text', text: ' points per game.' },
    ]);
  });

  it('colors team abbreviations', () => {
    const segments = parseAnswerSegments('The top shooter on TOR is Scottie Barnes.', {
      ...ctx,
      playerLinks: [{ name: 'Scottie Barnes', teamAbbreviation: 'TOR' }],
    });
    expect(segments).toContainEqual({ type: 'team', text: 'TOR', abbrev: 'TOR' });
    expect(segments).toContainEqual({
      type: 'player',
      text: 'Scottie Barnes',
      teamAbbreviation: 'TOR',
    });
  });

  it('highlights bold stats from markdown', () => {
    const segments = parseAnswerSegments('He shoots **48.2%** from deep.', ctx);
    expect(segments).toEqual([
      { type: 'text', text: 'He shoots ' },
      { type: 'stat', text: '48.2%' },
      { type: 'text', text: ' from deep.' },
    ]);
  });

  it('falls back to row stat values when not bolded', () => {
    const segments = parseAnswerSegments('LeBron James averages 24.8 points per game.', ctx);
    expect(segments).toContainEqual({ type: 'stat', text: '24.8' });
  });

  it('prefers longest player name match', () => {
    const segments = parseAnswerSegments('LeBron James leads the league.', ctx);
    expect(segments[0]).toEqual({
      type: 'player',
      text: 'LeBron James',
      teamAbbreviation: 'LAL',
    });
  });

  it('does not false-match partial team abbrevs', () => {
    const segments = parseAnswerSegments('ATLANTA is not a team code here.', ctx);
    expect(segments.every((s) => s.type !== 'team')).toBe(true);
  });

  it('styles ordinal suffixes with the stat', () => {
    const quarterCtx = {
      ...ctx,
      rows: [{ period: 2, attempts: 268, fg_pct: 0.403 }],
      columns: ['period', 'attempts', 'fg_pct'],
    };

    expect(parseAnswerSegments('His **2**nd quarter percentage is **40.3%**.', quarterCtx)).toEqual([
      { type: 'text', text: 'His ' },
      { type: 'stat', text: '2nd' },
      { type: 'text', text: ' quarter percentage is ' },
      { type: 'stat', text: '40.3%' },
      { type: 'text', text: '.' },
    ]);

    expect(parseAnswerSegments('He shoots better in the 4th quarter.', quarterCtx)).toContainEqual({
      type: 'stat',
      text: '4th',
    });
  });
});
