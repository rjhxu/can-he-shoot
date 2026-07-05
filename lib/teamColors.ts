/** Primary / secondary brand colors for subtle headshot glow (hex). */

export interface TeamGlowColors {
  primary: string;
  secondary: string;
}

const FALLBACK: TeamGlowColors = {
  primary: '#64748b',
  secondary: '#334155',
};

export const NBA_TEAM_ABBREVS = [
  'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
  'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
  'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS',
] as const;

const MAP: Record<string, TeamGlowColors> = {
  ATL: { primary: '#e03a3e', secondary: '#c1d32f' },
  BOS: { primary: '#007a33', secondary: '#ba9653' },
  BKN: { primary: '#000000', secondary: '#ffffff' },
  CHA: { primary: '#1d1160', secondary: '#00788c' },
  CHI: { primary: '#ce1141', secondary: '#000000' },
  CLE: { primary: '#860038', secondary: '#041e42' },
  DAL: { primary: '#00538c', secondary: '#002b5e' },
  DEN: { primary: '#0e2240', secondary: '#fec524' },
  DET: { primary: '#c8102e', secondary: '#1d42ba' },
  GSW: { primary: '#1d428a', secondary: '#ffc72c' },
  HOU: { primary: '#ce1141', secondary: '#000000' },
  IND: { primary: '#002d62', secondary: '#fdbb30' },
  LAC: { primary: '#c8102e', secondary: '#1d428a' },
  LAL: { primary: '#552583', secondary: '#fdb927' },
  MEM: { primary: '#5d76a9', secondary: '#12173f' },
  MIA: { primary: '#98002e', secondary: '#f9a01b' },
  MIL: { primary: '#00471b', secondary: '#eee1c6' },
  MIN: { primary: '#0c2340', secondary: '#236192' },
  NOP: { primary: '#0c2340', secondary: '#c8102e' },
  NYK: { primary: '#006bb6', secondary: '#f58426' },
  OKC: { primary: '#007ac1', secondary: '#ef3b24' },
  ORL: { primary: '#0077c0', secondary: '#c4ced4' },
  PHI: { primary: '#006bb6', secondary: '#ed174c' },
  PHX: { primary: '#1d1160', secondary: '#e56020' },
  POR: { primary: '#e03a3e', secondary: '#000000' },
  SAC: { primary: '#5a2d81', secondary: '#63727a' },
  SAS: { primary: '#c4ced4', secondary: '#000000' },
  TOR: { primary: '#ce1141', secondary: '#000000' },
  UTA: { primary: '#002b5c', secondary: '#00471b' },
  WAS: { primary: '#002b5c', secondary: '#e31837' },
};

export function teamGlowColors(abbrev: string): TeamGlowColors {
  const key = abbrev?.trim().toUpperCase();
  if (!key) return FALLBACK;
  return MAP[key] ?? FALLBACK;
}

/** Relative luminance (sRGB) for contrast against a light background (~#f8f7f5). */
function relativeLuminance(hex: string): number {
  const raw = hex.replace('#', '');
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** Readable team color for inline text on light/dark card backgrounds. */
export function teamTextColor(abbrev: string): string {
  const { primary, secondary } = teamGlowColors(abbrev);
  if (relativeLuminance(primary) < 0.25) return secondary;
  return primary;
}
