import { loadL3, runL3 } from '../../sim-runner/l3Bots';

export interface L3SurvivalSeed {
  seed: number;
  valid: boolean;
  s1: { completed: boolean; officerHits: number; damage: number } | null;
  density: { near30: number[]; maxConcurrent: number; cap: number };
}

/** Same mortal complete-input L3 fixture used by qa:accept, retained for the
 * seed-sensitive threat rows so both gates apply the same 2-of-3 vote. */
export async function l3SurvivalSeeds(tier: 'low' | 'high', seeds: readonly number[] = [1, 2, 3]): Promise<L3SurvivalSeed[]> {
  const rows: L3SurvivalSeed[] = [];
  for (const seed of seeds) {
    let world: Awaited<ReturnType<typeof loadL3>>['world'] | undefined;
    try {
      const loaded = await loadL3(seed, tier); world = loaded.world;
      const report = runL3(world, loaded.mission, 'complete', { seed, maxSeconds: 600, god: false });
      rows.push({ seed, valid: report.outcome === 'complete' && !!report.s1?.completed, s1: report.s1, density: report.density });
    } catch {
      rows.push({ seed, valid: false, s1: null, density: { near30: [], maxConcurrent: 0, cap: 0 } });
    } finally { world?.dispose(); }
  }
  return rows;
}
