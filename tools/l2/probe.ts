import { loadL2, runL2 } from '../sim-runner/l2Bots';
import type { L2Opening, L2Profile } from '../../src/debug/bot/LevelTwoBot';
/** Dev aid: one L2 bot run with a compact report. `npx tsx tools/l2/probe.ts complete 1 side` */
const short: Record<string, L2Profile> = { c: 'complete', n: 'newbie', x: 'no-axe', a: 'aggressive', i: 'idle' }, profile = (short[process.argv[2] ?? 'c'] ?? process.argv[2]) as L2Profile, seed = Number(process.argv[3] ?? 1), opening = (process.argv[4] ?? 'side') as L2Opening;
const { world, mission } = await loadL2(seed);
const started = performance.now();
const r = runL2(world, mission, profile, { seed, opening, maxSeconds: Number(process.argv[5] ?? 420) });
const p = world.entities.get(1)!.transform;
console.log(JSON.stringify({ ...r, wallS: ((performance.now() - started) / 1000).toFixed(1), player: { x: p.x.toFixed(1), z: p.z.toFixed(1), hp: world.entities.get(1)!.health.current }, phase: mission.state.l2!.phase, active: mission.def.steps.filter(s => mission.state.steps[s.id].status === 'active').map(s => s.id) }, null, 1));
world.dispose();
