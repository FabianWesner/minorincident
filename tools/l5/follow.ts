// Follower distance trace: npx tsx tools/l5/follow.ts <seed> [from] [to]
import { loadL5, runL5 } from '../sim-runner/l5Bots';

const seed = Number(process.argv[2] ?? 1), from = Number(process.argv[3] ?? 40), to = Number(process.argv[4] ?? 110);
const { world, mission } = await loadL5(seed);
runL5(world, mission, 'complete', { seed, maxSeconds: to, each: tick => {
  if (tick % 60 !== 0 || tick < from * 60) return;
  const p = world.entities.get(1)!.transform, s = mission.state.l5!;
  const d = s.survivors.filter(r => r.status === 'following').map(r => { const e = world.entities.get(r.id)!; return `${r.key}:${Math.hypot(e.transform.x - p.x, e.transform.z - p.z).toFixed(1)}${e.civilian!.survivor!.cover ? 'c' : ''}`; });
  const v = world.entities.get(1)!.survivor!.velocity;
  console.log(`t=${tick / 60} v=${Math.hypot(v.x, v.z).toFixed(1)} ${d.join(' ')}`);
} });
