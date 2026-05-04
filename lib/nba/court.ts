/**
 * Half-court geometry in SVG screen coordinates (y-down).
 *
 * NBA stats data uses LOC_X / LOC_Y in tenths of a foot, with the hoop near
 * the origin and positive Y pointing AWAY from the baseline (up the court).
 * SVG's y-axis points down, so we negate Y when plotting:
 *   svgX = LOC_X
 *   svgY = -LOC_Y
 *
 * In SVG-coord terms used throughout this file:
 *   - hoop center: (0, 0)
 *   - baseline:    y = +47.5  (below the hoop visually)
 *   - half-court:  y = -422.5 (top of viewBox)
 *   - sidelines:   x = +-250
 *
 * SVG y-down sweep-flag rule: 1 = clockwise, 0 = counter-clockwise (visual).
 */

export const COURT = {
  width: 500,
  height: 470,
  baselineY: 47.5,
  halfCourtY: -422.5,
  sidelineX: 250,
  hoopRadius: 7.5,
  paintHalfWidth: 80,
  paintTopY: -142.5,
  ftCircleR: 60,
  raRadius: 40,
  threeArcR: 237.5,
  cornerThreeX: 220,
  // Where the 22 ft corner-3 line meets the 23.75 ft arc:
  // y = -sqrt(237.5^2 - 220^2) = -89.475...
  cornerBreakY: -89.5,
  backboardY: -7.5,
  backboardHalfWidth: 30,
} as const;

export const COURT_VIEWBOX = '-250 -422.5 500 470';

/** Convert NBA stats LOC_X/LOC_Y to SVG coordinates used in this file. */
export function toSvg(locX: number, locY: number): [number, number] {
  return [locX, -locY];
}

export interface CourtLine {
  key: string;
  d: string;
}

/**
 * Court line paths. Render under one stroked `<g>` so they share styling.
 */
export const COURT_LINES: CourtLine[] = [
  { key: 'baseline', d: 'M -250,47.5 L 250,47.5' },
  { key: 'sideline-left', d: 'M -250,47.5 L -250,-422.5' },
  { key: 'sideline-right', d: 'M 250,47.5 L 250,-422.5' },
  { key: 'half-court', d: 'M -250,-422.5 L 250,-422.5' },
  { key: 'half-court-circle', d: 'M -60,-422.5 A 60,60 0 0 1 60,-422.5' },
  { key: 'paint', d: 'M -80,47.5 L -80,-142.5 L 80,-142.5 L 80,47.5' },
  { key: 'ft-line', d: 'M -80,-142.5 L 80,-142.5' },
  { key: 'ft-circle-top', d: 'M -60,-142.5 A 60,60 0 0 1 60,-142.5' },
  { key: 'ft-circle-bottom', d: 'M 60,-142.5 A 60,60 0 0 1 -60,-142.5' },
  { key: 'backboard', d: 'M -30,-7.5 L 30,-7.5' },
  {
    key: 'hoop',
    d: 'M 7.5,0 A 7.5,7.5 0 0 1 -7.5,0 A 7.5,7.5 0 0 1 7.5,0',
  },
  { key: 'restricted-area', d: 'M -40,0 A 40,40 0 0 1 40,0' },
  { key: 'corner-3-left', d: 'M -220,47.5 L -220,-89.5' },
  { key: 'corner-3-right', d: 'M 220,47.5 L 220,-89.5' },
  {
    key: 'three-arc',
    d: 'M -220,-89.5 A 237.5,237.5 0 0 1 220,-89.5',
  },
];

export interface ZoneDef {
  /** Stable identifier for React keys / lookups. */
  id: string;
  /** Maps to NBA stats `SHOT_ZONE_BASIC`. */
  basic: string;
  /** Maps to NBA stats `SHOT_ZONE_AREA`. */
  area: string;
  /** Short, human-readable label shown in tooltips. */
  label: string;
  /** SVG path data for the zone polygon. */
  d: string;
  /** Center point for the FGM/FGA/FG% text overlay. */
  textPos: { x: number; y: number };
  /** Path fill rule (only set when the polygon has a hole). */
  fillRule?: 'nonzero' | 'evenodd';
}

/**
 * Twelve standard NBA shot-chart zones, keyed by `${basic}|${area}`.
 * Geometry is approximate — chosen to tile the half court without overlap
 * while matching the bucket each shot's `SHOT_ZONE_*` fields fall into.
 */
export const ZONES: ZoneDef[] = [
  {
    id: 'ra-c',
    basic: 'Restricted Area',
    area: 'Center(C)',
    label: 'Restricted Area',
    d: 'M -40,0 L -40,47.5 L 40,47.5 L 40,0 A 40,40 0 0 0 -40,0 Z',
    textPos: { x: 0, y: 25 },
  },
  {
    id: 'paint-c',
    basic: 'In The Paint (Non-RA)',
    area: 'Center(C)',
    label: 'Paint (Non-RA)',
    d:
      'M 40,47.5 L 80,47.5 L 80,-142.5 L -80,-142.5 L -80,47.5 L -40,47.5 ' +
      'L -40,0 A 40,40 0 0 1 40,0 L 40,47.5 Z',
    textPos: { x: 0, y: -90 },
  },
  {
    id: 'mid-c',
    basic: 'Mid-Range',
    area: 'Center(C)',
    label: 'Mid-Range — Center',
    d:
      'M -59.03,-142.5 L 59.03,-142.5 L 90.85,-219.4 ' +
      'A 237.5,237.5 0 0 0 -90.85,-219.4 Z',
    textPos: { x: 0, y: -180 },
  },
  {
    // Mid-Range RC: between 22.5° ray and the corner-break ray (line from
    // origin through the actual corner break (220, -89.5) ≈ 67.85°).
    // Inner edge runs along the paint top + paint side; outer edge follows
    // the 3-pt arc from corner break to the 22.5° point.
    id: 'mid-rc',
    basic: 'Mid-Range',
    area: 'Right Side Center(RC)',
    label: 'Mid-Range — Right Wing',
    d:
      'M 90.85,-219.4 L 59.03,-142.5 L 80,-142.5 L 80,-32.55 L 220,-89.5 ' +
      'A 237.5,237.5 0 0 0 90.85,-219.4 Z',
    textPos: { x: 145, y: -160 },
  },
  {
    id: 'mid-lc',
    basic: 'Mid-Range',
    area: 'Left Side Center(LC)',
    label: 'Mid-Range — Left Wing',
    d:
      'M -90.85,-219.4 L -59.03,-142.5 L -80,-142.5 L -80,-32.55 L -220,-89.5 ' +
      'A 237.5,237.5 0 0 1 -90.85,-219.4 Z',
    textPos: { x: -145, y: -160 },
  },
  {
    // Mid-Range R: bounded by paint side, baseline, corner-3 line, and the
    // corner-break ray. Hits the corner break exactly so it tiles cleanly
    // with the corner 3 and ATB3 zones above it.
    id: 'mid-r',
    basic: 'Mid-Range',
    area: 'Right Side(R)',
    label: 'Mid-Range — Right Baseline',
    d: 'M 80,47.5 L 80,-32.55 L 220,-89.5 L 220,47.5 Z',
    textPos: { x: 150, y: -20 },
  },
  {
    id: 'mid-l',
    basic: 'Mid-Range',
    area: 'Left Side(L)',
    label: 'Mid-Range — Left Baseline',
    d: 'M -80,47.5 L -80,-32.55 L -220,-89.5 L -220,47.5 Z',
    textPos: { x: -150, y: -20 },
  },
  {
    id: 'corner-3-r',
    basic: 'Right Corner 3',
    area: 'Right Side(R)',
    label: 'Right Corner 3',
    d: 'M 220,47.5 L 250,47.5 L 250,-89.5 L 220,-89.5 Z',
    textPos: { x: 235, y: -20 },
  },
  {
    id: 'corner-3-l',
    basic: 'Left Corner 3',
    area: 'Left Side(L)',
    label: 'Left Corner 3',
    d: 'M -250,47.5 L -220,47.5 L -220,-89.5 L -250,-89.5 Z',
    textPos: { x: -235, y: -20 },
  },
  {
    // ATB3 RC: a flat horizontal bottom at the corner-break y (-89.5)
    // means it shares its bottom-right edge cleanly with Corner 3 R's
    // top edge — eliminates the small triangle gap that appeared when
    // the boundary was angled along the 67.5° ray.
    id: 'atb3-rc',
    basic: 'Above the Break 3',
    area: 'Right Side Center(RC)',
    label: 'Above-Break 3 — Right Wing',
    d:
      'M 220,-89.5 L 250,-89.5 L 250,-422.5 L 175.1,-422.5 ' +
      'L 90.85,-219.4 A 237.5,237.5 0 0 1 220,-89.5 Z',
    textPos: { x: 200, y: -260 },
  },
  {
    id: 'atb3-c',
    basic: 'Above the Break 3',
    area: 'Center(C)',
    label: 'Above-Break 3 — Top',
    d:
      'M -90.85,-219.4 L -175.1,-422.5 L 175.1,-422.5 L 90.85,-219.4 ' +
      'A 237.5,237.5 0 0 0 -90.85,-219.4 Z',
    textPos: { x: 0, y: -320 },
  },
  {
    id: 'atb3-lc',
    basic: 'Above the Break 3',
    area: 'Left Side Center(LC)',
    label: 'Above-Break 3 — Left Wing',
    d:
      'M -220,-89.5 L -250,-89.5 L -250,-422.5 L -175.1,-422.5 ' +
      'L -90.85,-219.4 A 237.5,237.5 0 0 0 -220,-89.5 Z',
    textPos: { x: -200, y: -260 },
  },
];

export const ZONES_BY_KEY: Map<string, ZoneDef> = new Map(
  ZONES.map((z) => [`${z.basic}|${z.area}`, z]),
);

export function zoneKey(basic: string, area: string): string {
  return `${basic}|${area}`;
}
