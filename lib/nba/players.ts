import { unstable_cache } from 'next/cache';
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

/** Resolve shot-chart links from Cohere IDs, then query result columns as fallback. */
export async function resolvePlayerLinksForAsk(
  referencedIds: number[],
  columns: string[],
  rows: Record<string, unknown>[],
): Promise<{ personId: number; name: string }[]> {
  const ids = [...new Set([...referencedIds, ...extractPersonIdsFromResults(columns, rows)])];

  let links = await resolvePlayersByIds(ids);
  if (links.length === 0) {
    links = await resolvePlayersByNames(extractPlayerNamesFromResults(columns, rows));
  }

  const seen = new Set<number>();
  return links.filter((link) => {
    if (seen.has(link.personId)) return false;
    seen.add(link.personId);
    return true;
  });
}

export async function resolvePlayersByIds(
  personIds: number[],
): Promise<{ personId: number; name: string }[]> {
  if (personIds.length === 0) return [];

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('nba_players')
    .select('person_id, display_first_last')
    .in('person_id', personIds);

  if (error) {
    throw new Error(`Failed to resolve player names: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    personId: Number(row.person_id),
    name: String(row.display_first_last ?? ''),
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

export async function resolvePlayersByNames(
  names: string[],
): Promise<{ personId: number; name: string }[]> {
  if (names.length === 0) return [];

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('nba_players')
    .select('person_id, display_first_last')
    .in('display_first_last', names);

  if (error) {
    throw new Error(`Failed to resolve players by name: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    personId: Number(row.person_id),
    name: String(row.display_first_last ?? ''),
  }));
}
