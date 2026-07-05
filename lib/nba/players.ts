import { unstable_cache } from 'next/cache';
import { extractPlayerNameFilterGroups } from '@/lib/sql/playerFilter';
import { getSupabaseServerClient } from '@/lib/supabase';
import type { Player } from './types';

const getCachedActivePlayers = unstable_cache(
  async (): Promise<Player[]> => {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('nba_players')
      .select(
        'person_id, display_first_last, team_id, team_abbreviation, rosterstatus, from_year, to_year',
      )
      .eq('rosterstatus', '1')
      .neq('team_id', 0)
      .order('display_first_last', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch players from Supabase: ${error.message}`);
    }

    return (data ?? []).map((row) => ({
      personId: Number(row.person_id ?? 0),
      fullName: String(row.display_first_last ?? ''),
      teamId: Number(row.team_id ?? 0),
      teamAbbreviation: String(row.team_abbreviation ?? ''),
      rosterStatus: Number(row.rosterstatus ?? 0),
      fromYear: String(row.from_year ?? ''),
      toYear: String(row.to_year ?? ''),
    }));
  },
  ['nba_players_active'],
  { revalidate: 86_400 },
);

export async function getActivePlayers(): Promise<Player[]> {
  return getCachedActivePlayers();
}

export interface AskPlayerLink {
  personId: number;
  name: string;
  teamAbbreviation: string;
}

/** Resolve players matching name ILIKE filters embedded in generated SQL. */
export async function resolvePlayersFromSqlNameFilters(sql: string): Promise<AskPlayerLink[]> {
  const groups = extractPlayerNameFilterGroups(sql);
  if (groups.length === 0) return [];

  const supabase = getSupabaseServerClient();
  const links: AskPlayerLink[] = [];
  const seen = new Set<number>();

  for (const patterns of groups) {
    let query = supabase
      .from('nba_players')
      .select('person_id, display_first_last, team_abbreviation');

    for (const pattern of patterns) {
      query = query.ilike('display_first_last', pattern);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to resolve players from SQL name filters: ${error.message}`);
    }

    for (const row of data ?? []) {
      const personId = Number(row.person_id);
      if (!Number.isInteger(personId) || personId <= 0 || seen.has(personId)) continue;
      seen.add(personId);
      links.push({
        personId,
        name: String(row.display_first_last ?? ''),
        teamAbbreviation: String(row.team_abbreviation ?? ''),
      });
    }
  }

  return links;
}

function dedupePlayerLinks(links: AskPlayerLink[]): AskPlayerLink[] {
  const seen = new Set<number>();
  return links.filter((link) => {
    if (seen.has(link.personId)) return false;
    seen.add(link.personId);
    return true;
  });
}

/** Resolve shot-chart links from query results, SQL name filters, then Cohere IDs. */
export async function resolvePlayerLinksForAsk(
  referencedIds: number[],
  columns: string[],
  rows: Record<string, unknown>[],
  sql?: string,
): Promise<AskPlayerLink[]> {
  const idsFromResults = extractPersonIdsFromResults(columns, rows);
  let links: AskPlayerLink[];

  if (idsFromResults.length > 0) {
    links = await resolvePlayersByIds(idsFromResults);
  } else if (sql) {
    links = await resolvePlayersFromSqlNameFilters(sql);
  } else {
    links = [];
  }

  if (links.length === 0) {
    links = await resolvePlayersByIds([...new Set(referencedIds)]);
  }

  if (links.length === 0) {
    links = await resolvePlayersByNames(extractPlayerNamesFromResults(columns, rows));
  }

  return dedupePlayerLinks(links).map((link) => ({
    ...link,
    teamAbbreviation:
      teamFromRowsForPlayer(link.personId, link.name, columns, rows) ?? link.teamAbbreviation,
  }));
}

export async function resolvePlayersByIds(personIds: number[]): Promise<AskPlayerLink[]> {
  if (personIds.length === 0) return [];

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('nba_players')
    .select('person_id, display_first_last, team_abbreviation')
    .in('person_id', personIds);

  if (error) {
    throw new Error(`Failed to resolve player names: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    personId: Number(row.person_id),
    name: String(row.display_first_last ?? ''),
    teamAbbreviation: String(row.team_abbreviation ?? ''),
  }));
}

const PLAYER_NAME_COLUMNS = ['display_first_last', 'player_name'] as const;

export function extractPersonIdsFromResults(
  columns: string[],
  rows: Record<string, unknown>[],
): number[] {
  if (!columns.includes('person_id')) return [];

  const ids = new Set<number>();
  for (const row of rows) {
    const id = Number(row.person_id);
    if (Number.isInteger(id) && id > 0) ids.add(id);
  }
  return [...ids];
}

export function extractPlayerNamesFromResults(
  columns: string[],
  rows: Record<string, unknown>[],
): string[] {
  const nameColumn = PLAYER_NAME_COLUMNS.find((col) => columns.includes(col));
  if (!nameColumn) return [];

  const names = new Set<string>();
  for (const row of rows) {
    const name = row[nameColumn];
    if (typeof name === 'string' && name.trim()) names.add(name.trim());
  }
  return [...names];
}

export async function resolvePlayersByNames(names: string[]): Promise<AskPlayerLink[]> {
  if (names.length === 0) return [];

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('nba_players')
    .select('person_id, display_first_last, team_abbreviation')
    .in('display_first_last', names);

  if (error) {
    throw new Error(`Failed to resolve players by name: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    personId: Number(row.person_id),
    name: String(row.display_first_last ?? ''),
    teamAbbreviation: String(row.team_abbreviation ?? ''),
  }));
}

function teamFromRowsForPlayer(
  personId: number,
  name: string,
  columns: string[],
  rows: Record<string, unknown>[],
): string | undefined {
  if (!columns.includes('team_abbreviation')) return undefined;

  const nameColumn = PLAYER_NAME_COLUMNS.find((col) => columns.includes(col));
  const hasPersonId = columns.includes('person_id');

  for (const row of rows) {
    const matchesPlayer =
      (hasPersonId && Number(row.person_id) === personId) ||
      (nameColumn != null && row[nameColumn] === name);

    if (!matchesPlayer) continue;

    const team = row.team_abbreviation;
    if (typeof team === 'string' && team.trim()) return team.trim();
  }

  return undefined;
}
