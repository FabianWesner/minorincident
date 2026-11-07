/** Shared 2-of-3 vote for seed-sensitive L3 clauses. A seed only votes when
 * its route completed and the clause was measured; absolute targets stay with
 * each caller. */
export interface L3SeedVote { seed: number; valid: boolean; pass: boolean | null }
export interface L3SeedVerdict { seeds: L3SeedVote[]; measured: number; within: number; pass: boolean | undefined }

export function l3SeedVerdict(seeds: L3SeedVote[]): L3SeedVerdict {
  const unique = seeds.filter((row, i) => seeds.findIndex(other => other.seed === row.seed) === i);
  const valid = unique.filter(row => row.valid && row.pass !== null);
  const within = valid.filter(row => row.pass).length;
  return { seeds: unique, measured: valid.length, within, pass: valid.length >= 2 ? within >= 2 : undefined };
}
