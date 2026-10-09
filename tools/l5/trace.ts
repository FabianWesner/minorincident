// Trace how survivors are lost: npx tsx tools/l5/trace.ts <seed> [profile] [maxSeconds]
import { loadL5, runL5 } from '../sim-runner/l5Bots';
import type { L5Profile } from '../../src/debug/bot/LevelFiveBot';

const seed = Number(process.argv[2] ?? 1), profile = ({ c: 'complete', n: 'newbie', e: 'evade-only', i: 'idle' }[process.argv[3] ?? 'c'] ?? process.argv[3]) as L5Profile, max = Number(process.argv[4] ?? 300);
const { world, mission } = await loadL5(seed);
const keyOf = new Map(mission.state.l5!.survivors.map(r => [r.id, r.key]));
const t = (tick: number) => (tick / 60).toFixed(1);
world.events.on('civilian.grabbed', e => {
  if (e.type !== 'civilian.grabbed' || !keyOf.has(e.targetId)) return;
  const v = world.entities.get(e.targetId)!, a = world.entities.get(e.sourceId)!, p = world.entities.get(1)!.transform;
  console.log(`t=${t(e.tick)} GRAB ${keyOf.get(e.targetId)} at (${v.transform.x.toFixed(0)},${v.transform.z.toFixed(0)}) by ${e.sourceId} (${a.transform.x.toFixed(0)},${a.transform.z.toFixed(0)}) player (${p.x.toFixed(0)},${p.z.toFixed(0)}) d=${Math.hypot(v.transform.x - p.x, v.transform.z - p.z).toFixed(1)} cover=${v.civilian?.survivor?.cover}`);
});
world.events.on('l5.found', e => { if (e.type === 'l5.found') console.log(`t=${t(e.tick)} FOUND ${e.key}`); });
world.events.on('combat.attack', e => { if (e.type === 'combat.attack' && e.sourceId === 1 && e.actionId === 'weapon.army-mg' && e.tick % 30 === 0) console.log(`t=${t(e.tick)} mg`); });
const r = runL5(world, mission, profile, { seed, maxSeconds: max, each: tick => {
  if (tick % 300 === 0) {
    const p = world.entities.get(1)!.transform, ids = mission.state.l5!.survivors.filter(s => s.status === 'following').map(s => world.entities.get(s.id)!);
    console.log(`t=${t(tick)} player (${p.x.toFixed(0)},${p.z.toFixed(0)}) followers ${ids.map(f => `${f.civilian!.survivor!.key}(${f.transform.x.toFixed(0)},${f.transform.z.toFixed(0)}${f.civilian!.survivor!.cover ? ',cover' : ''})`).join(' ')} inf<14m ${world.infected!.active.filter(e => e.health.current > 0 && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 14).length}`);
  }
} });
console.log(r.outcome, r.simSeconds.toFixed(0), JSON.stringify(r.fates));
