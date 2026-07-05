import { createElement, type ReactNode } from 'react';
import { NBA_TEAM_ABBREVS, teamTextColor } from '@/lib/teamColors';

export interface AskAnswerContext {
  playerLinks: { name: string; teamAbbreviation: string }[];
  rows: Record<string, unknown>[];
  columns: string[];
}

export type AnswerSegment =
  | { type: 'text'; text: string }
  | { type: 'player'; text: string; teamAbbreviation: string }
  | { type: 'team'; text: string; abbrev: string }
  | { type: 'stat'; text: string };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Build display strings for numeric values that may appear in the answer. */
export function extractStatStringsFromRows(rows: Record<string, unknown>[]): string[] {
  const stats = new Set<string>();

  for (const row of rows) {
    for (const value of Object.values(row)) {
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;

      if (Number.isInteger(value)) {
        stats.add(String(value));
        continue;
      }

      const trimmed = value.toFixed(3).replace(/\.?0+$/, '');
      stats.add(trimmed);

      if (value > 0 && value <= 1) {
        const pct = (value * 100).toFixed(1).replace(/\.0$/, '');
        stats.add(`${pct}%`);
      }
    }
  }

  return [...stats].sort((a, b) => b.length - a.length);
}

interface MatchCandidate {
  length: number;
  segment: AnswerSegment;
}

function findMatchAt(
  text: string,
  index: number,
  ctx: AskAnswerContext,
  statStrings: string[],
): MatchCandidate | null {
  const rest = text.slice(index);
  let best: MatchCandidate | null = null;

  const boldMatch = rest.match(/^\*\*([^*]+)\*\*/);
  if (boldMatch) {
    best = {
      length: boldMatch[0].length,
      segment: { type: 'stat', text: boldMatch[1] },
    };
  }

  const players = [...ctx.playerLinks].sort((a, b) => b.name.length - a.name.length);
  for (const player of players) {
    const pattern = new RegExp(`^${escapeRegExp(player.name)}`, 'i');
    const match = rest.match(pattern);
    if (!match) continue;
    const candidate: MatchCandidate = {
      length: match[0].length,
      segment: {
        type: 'player',
        text: match[0],
        teamAbbreviation: player.teamAbbreviation,
      },
    };
    if (!best || candidate.length > best.length) best = candidate;
  }

  for (const abbrev of NBA_TEAM_ABBREVS) {
    const pattern = new RegExp(`^\\b${abbrev}\\b`, 'i');
    const match = rest.match(pattern);
    if (!match) continue;
    const candidate: MatchCandidate = {
      length: match[0].length,
      segment: { type: 'team', text: match[0], abbrev: match[0].toUpperCase() },
    };
    if (!best || candidate.length > best.length) best = candidate;
  }

  for (const stat of statStrings) {
    const pattern = new RegExp(`^${escapeRegExp(stat)}`);
    const match = rest.match(pattern);
    if (!match) continue;
    const candidate: MatchCandidate = {
      length: match[0].length,
      segment: { type: 'stat', text: match[0] },
    };
    if (!best || candidate.length > best.length) best = candidate;
  }

  return best;
}

/** Parse an ask answer into styled segments (pure, testable). */
export function parseAnswerSegments(answer: string, ctx: AskAnswerContext): AnswerSegment[] {
  const statStrings = extractStatStringsFromRows(ctx.rows);
  const segments: AnswerSegment[] = [];
  let index = 0;

  while (index < answer.length) {
    const match = findMatchAt(answer, index, ctx, statStrings);
    if (!match) {
      segments.push({ type: 'text', text: answer[index] });
      index += 1;
      continue;
    }

    segments.push(match.segment);
    index += match.length;
  }

  return mergeAdjacentText(segments);
}

function mergeAdjacentText(segments: AnswerSegment[]): AnswerSegment[] {
  const merged: AnswerSegment[] = [];
  for (const segment of segments) {
    const prev = merged[merged.length - 1];
    if (segment.type === 'text' && prev?.type === 'text') {
      prev.text += segment.text;
    } else {
      merged.push({ ...segment });
    }
  }
  return merged;
}

const STAT_CLASS =
  'rounded-md bg-accent/15 px-1 font-bold tabular-nums text-accent';

function segmentToNode(segment: AnswerSegment, key: number): ReactNode {
  switch (segment.type) {
    case 'text':
      return createElement('span', { key }, segment.text);
    case 'player':
      return createElement(
        'span',
        {
          key,
          className: 'font-semibold',
          style: { color: teamTextColor(segment.teamAbbreviation) },
        },
        segment.text,
      );
    case 'team':
      return createElement(
        'span',
        {
          key,
          className: 'font-semibold',
          style: { color: teamTextColor(segment.abbrev) },
        },
        segment.text,
      );
    case 'stat':
      return createElement('strong', { key, className: STAT_CLASS }, segment.text);
  }
}

export function renderEnrichedAnswer(answer: string, ctx: AskAnswerContext): ReactNode[] {
  return parseAnswerSegments(answer, ctx).map((segment, i) => segmentToNode(segment, i));
}
