// Who takes the first survivors: node --import tsx/esm tools/qa/l5-rescue-loss.ts <c|n> <seed> [maxSeconds]
import { loadL5, runL5 } from '../sim-runner/l5Bots';
import type { L5Profile } from '../../src/debug/bot/LevelFiveBot';

const profile = ({ c: 'complete', n: 'newbie' }[process.argv[2] ?? 'n'] ?? process.argv[2]) as L5Profile;
const seed = Number(process.argv[3] ?? 1), max = Number(process.argv[4] ?? 150);
const { world, mission } = await loadL5(seed);
const d = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const seen = new Map<string, string>();
runL5(world, mission, profile, { seed, maxSeconds: max, each: tick => {
  const s = mission.state.l5!;
  for (const r of s.survivors) {
    if (seen.get(r.key) === r.status) continue;
    seen.set(r.key, r.status);
    if (r.status === 'hidden') continue;
    const e = world.entities.get(r.id), p = world.entities.get(1)!.transform, at = e?.transform ?? p;
    const near = world.infected!.active.filter(i => i.health.current > 0 && d(i.transform, at) < 9).map(i => `${i.archetype.replace('infected.', '')}#${i.id}@${d(i.transform, at).toFixed(1)}m/${i.infected!.state}/${i.infected!.l1?.mode}`);
    console.log(`t=${(tick / 60).toFixed(0)}s ${r.key} -> ${r.status} at (${at.x.toFixed(0)},${at.z.toFixed(0)}) player (${p.x.toFixed(0)},${p.z.toFixed(0)}) hp ${world.entities.get(1)!.health.current.toFixed(0)} near: ${near.join(' ')}`);
  }
} });
