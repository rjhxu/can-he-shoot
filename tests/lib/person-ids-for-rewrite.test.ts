import { describe, expect, it } from 'vitest';
import { personIdsForSqlRewrite } from '@/lib/sql/personIdsForRewrite';

describe('personIdsForSqlRewrite', () => {
  it('prefers DB-resolved IDs over wrong Cohere IDs', () => {
    expect(personIdsForSqlRewrite([1630567], [1631168])).toEqual([1630567]);
  });

  it('falls back to Cohere IDs when name resolution finds nothing', () => {
    expect(personIdsForSqlRewrite([], [1629029, 203999])).toEqual([1629029, 203999]);
  });

  it('dedupes and drops invalid IDs', () => {
    expect(personIdsForSqlRewrite([201939, 201939, 0], [201942])).toEqual([201939]);
  });
});
