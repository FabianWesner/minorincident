import { loadL2, runL2 } from '../sim-runner/l2Bots';
import type { L2Opening } from '../../src/debug/bot/LevelTwoBot';
/** Dev aid: where the player kills cluster members, and the cluster spread when the player reaches the approach. */
const seed = Number(process.argv[2] ?? 1), { world, mission } = await loadL2(seed);
const kills: string[] = [];
world.events.on('combat.kill', e => { if (e.type === 'combat.kill' && e.sourceId === 1 && mission.state.l2!.clusterIds.includes(e.targetId)) kills.push(`${(e.tick / 60).toFixed(0)}s@${e.position.x.toFixed(0)},${e.position.z.toFixed(0)}`); });
let logged = false;
world.events.on('sim.tick', () => {
  const s = mission.state.l2!;
  if (!logged && s.clusterReached) { logged = true; console.log('cluster reached', (world.tick / 60).toFixed(0), s.clusterIds.map(id => { const e = world.entities.get(id)!; return `${e.transform.x.toFixed(0)},${e.transform.z.toFixed(0)}:${e.infected?.l1?.mode ?? 'x'}:${e.health.current > 0 ? 'a' : 'd'}`; }).join(' ')); }
});
const r = runL2(world, mission, 'complete', { seed, opening: (process.argv[3] ?? 'side') as L2Opening });
console.log(r.outcome, r.simSeconds.toFixed(0), 'deaths', r.deaths, 'clusterKilled', r.clusterKilled, kills.join(' '));
world.dispose();
