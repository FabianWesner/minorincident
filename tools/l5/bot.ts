// L5 bot pass: npx tsx tools/l5/bot.ts [seed] [profile] [maxSeconds]
import { loadL5, runL5 } from '../sim-runner/l5Bots';
import type { L5Profile } from '../../src/debug/bot/LevelFiveBot';

const seed = Number(process.argv[2] ?? 1), profile = ({ c: 'complete', n: 'newbie', e: 'evade-only', i: 'idle' }[process.argv[3] ?? 'c'] ?? process.argv[3]) as L5Profile, max = Number(process.argv[4] ?? 600);
const { world, mission } = await loadL5(seed);
const t0 = Date.now();
const r = runL5(world, mission, profile, { seed, maxSeconds: max, each: tick => {
  if (tick % 900 === 0) { const p = world.entities.get(1)!.transform; console.log(`t=${(tick / 60).toFixed(0)}s phase=${mission.state.l5!.phase} p=(${p.x.toFixed(0)},${p.z.toFixed(0)}) hp=${world.entities.get(1)!.health.current.toFixed(0)} found=${mission.state.l5!.found}`); }
} });
console.log(JSON.stringify(r, null, 1));
console.log('wall s', (Date.now() - t0) / 1000);
