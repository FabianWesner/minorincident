/**
 * L3-06 "≥ 2 at the army line" (PO 2026-11-07: the squad has a real chance; was "≤ 2" until then) over three seeds (fix66-a rule, shared by the qa:accept battery fixture, the qa:accept
 * native complete clause and the qa:threat criterion so all three give one verdict). One pushable bag shifts the squad's
 * losses between seeds, so a single seed is noise: the clause passes when at least two seeds are valid (the run completed
 * and the courier reached the army line) and at least two of them bring at least two officers (median of three).
 * Fewer than two valid seeds is NOT MEASURED. The extra seed runs live in l3ArmySeeds.ts.
 */
export const armyLineMin = 2;
export const armyLineSeeds = [1, 2, 3] as const;
/** attacksPerMinute counts infected windups targeting the courier, not her shots. */
export interface ArmySeed { seed: number; valid: boolean; army: number | null; attacksPerMinute?: number | null }
export interface ArmyLineVerdict { seeds: ArmySeed[]; measured: number; within: number; pass: boolean | undefined }

export function armyLineVerdict(seeds: ArmySeed[]): ArmyLineVerdict {
  const valid = seeds.filter(s => s.valid && s.army !== null && s.army >= 0);
  const within = valid.filter(s => s.army! >= armyLineMin).length;
  return { seeds, measured: valid.length, within, pass: valid.length >= 2 ? within >= 2 : undefined };
}
