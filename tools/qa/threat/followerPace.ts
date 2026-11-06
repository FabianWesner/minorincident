import { followerSampleMinimum, median, type PhaseReceipt } from './observer';

export const followerPaceSeeds = [1, 2, 3] as const;
export interface FollowerPaceSeed {
  seed: number; valid: boolean; companions: number[];
  phases: Pick<PhaseReceipt, 'key' | 'followerSpeeds' | 'followerMedian'>[];
  outcome?: string; time?: number; nativeStateHash?: string;
  error?: string;
}
export interface FollowerPaceRow {
  phase: string; id: number; measured: number; failures: number; pass: boolean | undefined;
  seeds: { seed: number; valid: boolean; samples: number; median: number | null; groupMedian: number | null; ratio: number | null }[];
}
export interface FollowerPaceVerdict { rows: FollowerPaceRow[]; pass: boolean | undefined; flags: string[] }

/** Vote per follower AND phase: failures from different followers never combine.
 * At least two seeds must complete and supply ten walking samples for that ID.
 * A qualified follower/phase fails only on two or more of seeds 1–3. */
export function followerPaceVerdict(seeds: FollowerPaceSeed[], options: {
  required?: { phase: string; ids: readonly number[] }; stepsOnly?: boolean; humansOnly?: boolean;
} = {}): FollowerPaceVerdict {
  const selected = followerPaceSeeds.map(seed => {
    const matches = seeds.filter(row => row.seed === seed);
    return matches.length === 1 ? matches[0] : { seed, valid: false, companions: [], phases: [] };
  });
  const keys = new Map<string, Set<number>>();
  for (const seed of selected) for (const phase of seed.phases) {
    if (options.stepsOnly && !phase.key.startsWith('step/')) continue;
    const ids = keys.get(phase.key) ?? new Set<number>();
    for (const follower of phase.followerSpeeds) if (follower.samples >= followerSampleMinimum && !(options.humansOnly && seed.companions.includes(follower.id))) ids.add(follower.id);
    if (ids.size) keys.set(phase.key, ids);
  }
  if (options.required) {
    const ids = keys.get(options.required.phase) ?? new Set<number>();
    options.required.ids.forEach(id => ids.add(id)); keys.set(options.required.phase, ids);
  }
  const rows: FollowerPaceRow[] = [];
  for (const [phase, ids] of keys) for (const id of ids) {
    const values = selected.map(seed => {
      const group = seed.phases.find(row => row.key === phase);
      const follower = group?.followerSpeeds.find(row => row.id === id);
      const groupMedian = options.humansOnly ? median((group?.followerSpeeds ?? []).filter(row => row.samples >= followerSampleMinimum && !seed.companions.includes(row.id)).map(row => row.median)) : group?.followerMedian ?? null;
      const ratio = follower && groupMedian !== null && groupMedian > 0 ? follower.median / groupMedian : null;
      return { seed: seed.seed, valid: seed.valid && !!follower && follower.samples >= followerSampleMinimum && ratio !== null && Number.isFinite(ratio), samples: follower?.samples ?? 0, median: follower?.median ?? null, groupMedian, ratio };
    });
    const measured = values.filter(row => row.valid).length, failures = values.filter(row => row.valid && row.ratio! < .95).length;
    rows.push({ phase, id, seeds: values, measured, failures, pass: measured >= 2 ? failures < 2 : undefined });
  }
  const flags = rows.flatMap(row => row.pass === false ? [`${row.phase}:SLOW_FOLLOWER:${row.id}`] : row.pass === undefined && options.required?.phase === row.phase && options.required.ids.includes(row.id) ? [`${row.phase}:FOLLOWER_PACE_UNOBSERVED:${row.id}`] : []);
  return { rows, flags, pass: rows.some(row => row.pass === false) ? false : rows.length && rows.every(row => row.pass === true) ? true : undefined };
}
