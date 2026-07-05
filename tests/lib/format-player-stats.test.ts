import { describe, expect, it } from 'vitest';
import {
  fmtMakesAttempts,
  fmtMinutes,
  fmtPerGame,
  fmtPlusMinus,
} from '@/lib/formatPlayerStats';

describe('formatPlayerStats', () => {
  it('formats per-game integers and decimals', () => {
    expect(fmtPerGame(25)).toBe('25');
    expect(fmtPerGame(8.5)).toBe('8.5');
    expect(fmtPerGame(NaN)).toBe('—');
  });

  it('formats makes/attempts', () => {
    expect(fmtMakesAttempts(8.5, 18.2)).toBe('8.5/18.2');
    expect(fmtMakesAttempts(3, 7)).toBe('3/7');
  });

  it('formats plus/minus with sign', () => {
    expect(fmtPlusMinus(5.2)).toBe('+5.2');
    expect(fmtPlusMinus(-2)).toBe('-2');
    expect(fmtPlusMinus(0)).toBe('0');
    expect(fmtPlusMinus(null)).toBe('—');
  });

  it('formats minutes', () => {
    expect(fmtMinutes(34.2)).toBe('34.2');
  });
});
