/** Prefer DB-resolved person_ids from SQL name filters over Cohere's referenced_player_ids. */
export function personIdsForSqlRewrite(
  resolvedIds: number[],
  referencedIds: number[],
): number[] {
  const resolved = [...new Set(resolvedIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (resolved.length > 0) return resolved;

  return [...new Set(referencedIds.filter((id) => Number.isInteger(id) && id > 0))];
}
