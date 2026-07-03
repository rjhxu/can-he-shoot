import { fmtPct } from '@/lib/formatShot';

/** Per-game counting stat — one decimal when fractional. */
export function fmtPerGame(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Makes/attempts line for per-game shooting splits. */
export function fmtMakesAttempts(makes: number, attempts: number): string {
  if (!Number.isFinite(makes) || !Number.isFinite(attempts)) return '—';
  return `${fmtPerGame(makes)}/${fmtPerGame(attempts)}`;
}

export function fmtPlusMinus(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const rounded = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return n > 0 ? `+${rounded}` : rounded;
}

export function fmtMinutes(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(1);
}

export { fmtPct };
