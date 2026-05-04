import { nbaFetch, nbaUrl, tableToObjects } from './client';
import type { NbaApiResponse, Player } from './types';

const SEASON = '2025-26';

export async function getActivePlayers(): Promise<Player[]> {
  const url = nbaUrl('commonallplayers', {
    LeagueID: '00',
    Season: SEASON,
    IsOnlyCurrentSeason: 1,
  });

  const res = await nbaFetch(url, { revalidate: 86_400, tags: ['players'] });
  const payload = (await res.json()) as NbaApiResponse;

  const all = tableToObjects(payload, 'CommonAllPlayers', (row) => ({
    personId: Number(row.PERSON_ID),
    fullName: String(row.DISPLAY_FIRST_LAST ?? ''),
    teamId: Number(row.TEAM_ID ?? 0),
    teamAbbreviation: String(row.TEAM_ABBREVIATION ?? ''),
    rosterStatus: Number(row.ROSTERSTATUS ?? 0),
    fromYear: String(row.FROM_YEAR ?? ''),
    toYear: String(row.TO_YEAR ?? ''),
  }));

  return all
    .filter((p): p is Player => p.rosterStatus === 1 && p.teamId !== 0)
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}
