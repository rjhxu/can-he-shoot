/** Shared shot / zone percentage formatting for chart + sidebar. */

export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

export function fmtSignedPp(n: number): string {
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}pp`;
}
