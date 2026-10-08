import { loadL2, runL2 } from '../sim-runner/l2Bots';
import type { L2Opening, L2Profile } from '../../src/debug/bot/LevelTwoBot';
/** Dev aid: `npx tsx tools/l2/batch.ts c:1:side n:2:side ...` (c complete, n newbie, x no-axe, a aggressive, i idle). One line per run. */
const short: Record<string, L2Profile> = { c: 'complete', n: 'newbie', x: 'no-axe', a: 'aggressive', i: 'idle' };
for (const arg of process.argv.slice(2)) {
  const [p, seedText, opening = 'side', secs = '500', god = ''] = arg.split(':');
  const seed = Number(seedText), { world, mission } = await loadL2(seed), started = performance.now();
  const r = runL2(world, mission, short[p] ?? p as L2Profile, { seed, opening: opening as L2Opening, maxSeconds: Number(secs), god: god === 'god' });
  const pl = world.entities.get(1)!.transform;
  console.log(JSON.stringify({ p: r.profile, seed, opening, outcome: r.outcome, t: Math.round(r.simSeconds), deaths: r.deaths, deathsAt: r.deathsAt, kills: r.kills, axe: r.axe, cluster: `${r.clusterKilled}/${r.clusterSize}`, ff: r.firefighterHits, minHp: Math.round(r.minHp), at: `${pl.x.toFixed(0)},${pl.z.toFixed(0)}`, phase: mission.state.l2!.phase, at10: r.infectedAt[10]?.all, at90: r.infectedAt[90]?.all, near: r.killsNearDoors, approach: r.cluster?.atApproach, radio: r.radio, wall: Math.round((performance.now() - started) / 1000) }));
  world.dispose();
}
