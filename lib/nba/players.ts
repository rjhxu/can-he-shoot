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
