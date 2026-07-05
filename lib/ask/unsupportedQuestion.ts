import type { ZoneBasic } from '@/lib/nba/types';

export const OPPONENT_QUESTION_MESSAGE =
  "I can't answer matchup questions yet — shot logs don't include opponent teams. Try asking about a player's overall shooting, a court zone, or quarter splits instead.";

const VALID_SHOT_ZONE_BASIC = new Set<string>([
  'Restricted Area',
  'In The Paint (Non-RA)',
  'Mid-Range',
  'Left Corner 3',
  'Right Corner 3',
  'Above the Break 3',
  'Backcourt',
] satisfies ZoneBasic[]);

const STOP_WORDS = new Set([
  'how',
  'did',
  'what',
  'was',
  'were',
  'the',
  'this',
  'that',
  'against',
  'versus',
  'vs',
  'shoot',
  'shot',
  'shooting',
  'from',
  'when',
  'where',
  'who',
  'which',
  'best',
  'worst',
  'compare',
  'compared',
  'season',
  'game',
  'games',
  'many',
  'much',
  'average',
  'averaged',
  'percentage',
  'pct',
  'better',
  'worse',
  'during',
  'while',
  'playing',
  'play',
  'played',
  'and',
  'with',
  'for',
  'his',
  'her',
  'their',
  'he',
  'she',
  'they',
  'him',
  'them',
  'does',
  'do',
  'has',
  'have',
  'had',
  'most',
  'least',
  'more',
  'less',
  'any',
  'all',
  'per',
  'over',
  'under',
  'about',
  'into',
  'out',
  'off',
  'on',
  'at',
  'in',
  'by',
  'to',
  'of',
  'or',
  'an',
  'a',
]);

const TEAM_TOKENS = new Set([
  'celtics',
  'lakers',
  'warriors',
  'raptors',
  'heat',
  'knicks',
  'nets',
  'bulls',
  'bucks',
  'cavaliers',
  'cavs',
  'mavericks',
  'mavs',
  'nuggets',
  'rockets',
  'clippers',
  'suns',
  'spurs',
  'grizzlies',
  'pelicans',
  'hawks',
  'hornets',
  'magic',
  'pistons',
  'pacers',
  '76ers',
  'sixers',
  'timberwolves',
  'wolves',
  'thunder',
  'blazers',
  'kings',
  'wizards',
  'jazz',
  'boston',
  'brooklyn',
  'philadelphia',
  'toronto',
  'chicago',
  'cleveland',
  'dallas',
  'denver',
  'detroit',
  'golden',
  'state',
  'houston',
  'indiana',
  'lac',
  'lal',
  'memphis',
  'miami',
  'milwaukee',
  'minnesota',
  'orleans',
  'york',
  'oklahoma',
  'city',
  'orlando',
  'phoenix',
  'portland',
  'sacramento',
  'antonio',
  'utah',
  'washington',
  'atlanta',
  'charlotte',
]);

function hasTeamToken(text: string): boolean {
  const words = text.toLowerCase().match(/\b[a-z0-9]+\b/g) ?? [];
  return words.some((word) => TEAM_TOKENS.has(word));
}

/** Questions about shooting vs a specific opponent — not in schema. */
export function isOpponentQuestion(question: string): boolean {
  if (/\bagainst\b/i.test(question)) {
    return hasTeamToken(question) || /\bagainst\s+(?:the\s+)?[a-z]/i.test(question);
  }

  const vsMatch = question.match(/\b(?:vs\.?|versus)\b/i);
  if (!vsMatch || vsMatch.index === undefined) return false;

  const afterVs = question.slice(vsMatch.index + vsMatch[0].length);
  return hasTeamToken(afterVs) || hasTeamToken(question);
}

export function getUnsupportedQuestionMessage(question: string): string | null {
  return isOpponentQuestion(question) ? OPPONENT_QUESTION_MESSAGE : null;
}

/** Detect Cohere putting a team name in shot_zone_basic instead of returning WHERE false. */
export function hasHallucinatedOpponentFilter(sql: string): boolean {
  for (const match of sql.matchAll(/shot_zone_basic\s*(?:=|IN\s*\()\s*'([^']+)'/gi)) {
    const value = match[1]?.trim();
    if (value && !VALID_SHOT_ZONE_BASIC.has(value)) return true;
  }

  for (const match of sql.matchAll(/shot_zone_basic\s+IN\s*\(([^)]+)\)/gi)) {
    const values = match[1]?.match(/'([^']+)'/g) ?? [];
    for (const quoted of values) {
      const value = quoted.slice(1, -1).trim();
      if (value && !VALID_SHOT_ZONE_BASIC.has(value)) return true;
    }
  }

  return false;
}

export function extractPlayerNameTokens(question: string): string[] {
  const rawTokens = question.match(/\b[A-Za-z][A-Za-z']*\b/g) ?? [];
  const tokens: string[] = [];

  for (const token of rawTokens) {
    const lower = token.toLowerCase();
    if (lower.length < 3) continue;
    if (STOP_WORDS.has(lower)) continue;
    if (TEAM_TOKENS.has(lower)) continue;
    tokens.push(lower);
  }

  return tokens;
}

export function buildPlayerNameLookupSql(question: string): string | null {
  const tokens = extractPlayerNameTokens(question);
  if (tokens.length === 0) return null;

  const filters = tokens
    .map((token) => `p.display_first_last ILIKE '%${token.replace(/'/g, "''")}%'`)
    .join(' AND ');

  return `SELECT 1 FROM nba_players p WHERE ${filters} LIMIT 1`;
}
