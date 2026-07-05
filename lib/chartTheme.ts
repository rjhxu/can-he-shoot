/**
 * Shared theme palette for the SVG shot charts (heatmap + hex chart) and the
 * loading skeleton. Kept in one place so the chart, skeleton, and legends
 * can't drift apart.
 *
 * Light mode uses a muted editorial diverging scale: dusty rose below, sage
 * green above, with the court color as the neutral midpoint so average zones
 * blend into the floor instead of showing a muddy beige band.
 *
 * Interpolate these with d3.interpolateLab (not RGB) to keep mid-tones clean.
 */
export interface ChartTheme {
  courtBg: string;
  courtLine: string;
  hoverStroke: string;
  deltaBelow: string;
  deltaMid: string;
  deltaAbove: string;
  makesStart: string;
  makesEnd: string;
  missesStart: string;
  missesEnd: string;
  emptyFill: string;
  noLeagueFill: string;
  hexStroke: string;
  skeletonZone: string;
  skeletonLine: string;
  /** Zone stat pill background (heatmap labels). */
  labelBg: string;
  labelBorder: string;
  labelShadow: string;
}

export const CHART_THEMES: Record<'light' | 'dark', ChartTheme> = {
  light: {
    courtBg: '#f0ede8',
    courtLine: '#b5b0a6',
    hoverStroke: '#191a1e',
    deltaBelow: '#c45c52',
    deltaMid: '#f0ede8',
    deltaAbove: '#3a8f6e',
    makesStart: '#e4f0ea',
    makesEnd: '#1f6649',
    missesStart: '#f0ede8',
    missesEnd: '#b84050',
    emptyFill: 'rgba(25,26,30,0.035)',
    noLeagueFill: 'rgba(25,26,30,0.08)',
    hexStroke: 'rgba(25,26,30,0.10)',
    skeletonZone: 'rgb(211 208 200 / 0.45)',
    skeletonLine: 'rgb(168 164 155 / 0.50)',
    labelBg: 'rgba(255,255,255,0.88)',
    labelBorder: 'rgba(211,208,200,0.65)',
    labelShadow: '0 1px 2px rgba(25,26,30,0.10)',
  },
  dark: {
    courtBg: '#0e1219',
    courtLine: '#5b6474',
    hoverStroke: '#ffffff',
    deltaBelow: '#f43f5e',
    deltaMid: '#1e293b',
    deltaAbove: '#34d399',
    makesStart: '#14532d',
    makesEnd: '#34d399',
    missesStart: '#1e293b',
    missesEnd: '#f43f5e',
    emptyFill: 'rgba(255,255,255,0.05)',
    noLeagueFill: 'rgba(148,163,184,0.22)',
    hexStroke: 'rgba(15,23,42,0.55)',
    skeletonZone: 'rgb(51 59 77 / 0.55)',
    skeletonLine: 'rgb(102 110 125 / 0.45)',
    labelBg: 'rgba(19,23,32,0.82)',
    labelBorder: 'rgba(51,59,77,0.55)',
    labelShadow: '0 1px 3px rgba(0,0,0,0.45)',
  },
};

/** Resolve the chart palette from next-themes' resolvedTheme value. */
export function chartThemeFor(resolvedTheme: string | undefined): ChartTheme {
  return CHART_THEMES[resolvedTheme === 'light' ? 'light' : 'dark'];
}
