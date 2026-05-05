import type { ZoneAggregate } from './nba/types';
import { fmtSignedPp } from './formatShot';

/**
 * One-sided upper tail P(X >= fgm | n=fga, p) under Binomial(fga, p).
 * Used as "how unusual is this hot streak vs league-average skill" — not a
 * literal rank among all NBA players.
 */
export function binomialUpperTailP(fgm: number, fga: number, p: number): number {
  if (fga <= 0 || p <= 0 || p >= 1) return 1;
  const clampP = Math.min(1 - 1e-12, Math.max(1e-12, p));
  const logPs: number[] = [];
  for (let k = fgm; k <= fga; k++) {
    logPs.push(logBinomialPmF(k, fga, clampP));
  }
  if (logPs.length === 0) return 1;
  const m = Math.max(...logPs);
  const sumScaled = logPs.reduce((acc, lp) => acc + Math.exp(lp - m), 0);
  return Math.min(1, Math.max(0, Math.exp(m + Math.log(sumScaled))));
}

function logBinomialPmF(k: number, n: number, p: number): number {
  if (k < 0 || k > n) return -Infinity;
  return logChoose(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p);
}

function logChoose(n: number, k: number): number {
  if (k < 0 || k > n) return -Infinity;
  if (k === 0 || k === n) return 0;
  const kk = Math.min(k, n - k);
  let s = 0;
  for (let i = 0; i < kk; i++) {
    s += Math.log(n - i) - Math.log(i + 1);
  }
  return s;
}

/** Human-readable line for sidebar; null if not enough data. */
export function unusualVsLeagueLine(agg: ZoneAggregate): string | null {
  if (agg.fga < 5 || agg.leagueFgPct === null) return null;
  const pUp = binomialUpperTailP(agg.fgm, agg.fga, agg.leagueFgPct);
  const pct = (1 - pUp) * 100;
  if (pct >= 99) return `Roughly top 1% of outcomes vs league-average shooting in this zone.`;
  if (pct >= 95) return `Roughly top 5% of outcomes vs league-average shooting in this zone.`;
  if (pct >= 90) return `Roughly top 10% of outcomes vs league-average shooting in this zone.`;
  if (pUp >= 0.99) return `Roughly bottom 1% of outcomes vs league-average shooting in this zone.`;
  if (pUp >= 0.95) return `Roughly bottom 5% of outcomes vs league-average shooting in this zone.`;
  if (pUp >= 0.9) return `Roughly bottom 10% of outcomes vs league-average shooting in this zone.`;
  return null;
}

export function zoneVsLeagueTier(agg: ZoneAggregate): string {
  if (agg.fga === 0) return '';
  if (agg.leagueFgPct === null || agg.fgPctDelta === null) {
    return 'League comparison unavailable for this zone.';
  }
  const d = agg.fgPctDelta;
  const n = agg.fga;
  const small = n < 25;
  const prefix = small ? 'Small sample: ' : '';

  if (d >= 0.06) return `${prefix}Strong vs league (${fmtSignedPp(d)}).`;
  if (d >= 0.02) return `${prefix}Above league average (${fmtSignedPp(d)}).`;
  if (d > -0.02) return `${prefix}Roughly league average (${fmtSignedPp(d)}).`;
  if (d > -0.06) return `${prefix}Below league average (${fmtSignedPp(d)}).`;
  return `${prefix}Well below league (${fmtSignedPp(d)}).`;
}
