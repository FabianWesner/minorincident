import { loadL3, runL3, followFrustum } from '../sim-runner/l3Bots';
import { Session } from 'node:inspector/promises';
import { writeFileSync } from 'node:fs';
import { LevelThreeBot } from '../../src/debug/bot/LevelThreeBot';
/** L3 sim tick cost per phase (defence, horde street, rescue) in Node: the E18 sim p95 proxy for the perf spec phases.
 * Usage: npx tsx tools/balance/l3-simprof.ts [high|low] [seed] */
const tier = (process.argv[2] ?? 'high') as 'high' | 'low', seed = Number(process.argv[3] ?? 2);
const { world: w, mission: m } = await loadL3(seed, tier);
w.combat!.damage.god = true;
const bot = new LevelThreeBot(w, 'complete', 'auto');
const p95 = (v: number[]) => [...v].sort((a, b) => a - b)[Math.ceil(v.length * .95) - 1] ?? 0;
const tick = (measure?: number[]) => { followFrustum(w); w.applyInput(bot.sample(), 'keyboard'); const t = performance.now(); w.update(); if (measure) measure.push(performance.now() - t); };
const until = (cond: () => boolean, max: number) => { for (let i = 0; i < max && !cond(); i++) tick(); };
const session = new Session(); session.connect();
const phase = async (name: string, n: number) => { const v: number[] = []; let peak = 0; const prof = process.env.L3_PROF === name;
  if (prof) { await session.post('Profiler.enable'); await session.post('Profiler.start'); }
  for (let i = 0; i < n; i++) { tick(v); peak = Math.max(peak, w.infected!.director.count); }
  if (prof) { const { profile } = await session.post('Profiler.stop'); writeFileSync(`test-results/l3-${name}.cpuprofile`, JSON.stringify(profile)); }
  return { name, p95: +p95(v).toFixed(2), mean: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2), peak }; };
const out = [];
until(() => !!m.state.l3!.attackAt, 60 * 120);
until(() => w.tick - m.state.l3!.attackAt >= 40 * 60 || !!m.state.l3!.fallbackAt, 60 * 60);
out.push(await phase('defence', 8 * 60));
until(() => w.entities.get(1)!.transform.x >= 110, 60 * 400);
out.push(await phase('horde', 8 * 60));
until(() => w.entities.get(1)!.transform.x >= 219, 60 * 200);
out.push(await phase('rescue', 10 * 60));
console.log(JSON.stringify({ tier, seed, x: w.entities.get(1)!.transform.x, out }));
void runL3;
