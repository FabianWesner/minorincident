// L5 start census around the first survivors (Mia first): node --import tsx/esm tools/qa/l5-rescue-start.ts <seed>
import { loadL5, runL5 } from '../sim-runner/l5Bots';
import { l5Survivors } from '../../src/data/l5';

const seed = Number(process.argv[2] ?? 1);
const { world, mission } = await loadL5(seed);
const d = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const census = (label: string) => {
  const alive = world.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.infectionRise);
  const row: Record<string, string> = {};
  for (const s of l5Survivors) { const r = { x: s.ringAt[0], z: s.ringAt[1] }; row[s.key] = `${alive.filter(e => d(e.transform, r) < 20).length}/${alive.filter(e => d(e.transform, r) < 40).length}`; }
  const by: Record<string, number> = {}; for (const e of alive) by[e.archetype] = (by[e.archetype] ?? 0) + 1;
  console.log(label, 'alive', alive.length, 'within20/40:', JSON.stringify(row), JSON.stringify(by), 'directorCount', world.infected!.director.count, 'queue', world.infected!.director.queue.length);
};
census('t=0');
runL5(world, mission, 'idle', { seed, maxSeconds: 60 });
census('t=60 idle');
