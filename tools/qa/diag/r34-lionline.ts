/* eslint-disable @typescript-eslint/no-explicit-any -- diagnostic (r31-nadia) */
// Usage: node --import tsx/esm tools/qa/diag/l8nadia.ts <seed> <walk|idle|wander>
// Nadia-courier distance over the sanctuary step; plaza containment of Nadia + group at step completion.
import { loadLevel } from '../../sim-runner/levels';
import { followFrustum } from '../../sim-runner/l3Bots';
import { LevelEightBot } from '../../../src/debug/bot/LevelEightBot';
import { preset } from '../../../src/sim/progression/Campaign';
import { emptyInput } from '../../../src/input/InputFrame';
const seed = Number(process.argv[2] ?? 1), mode = process.argv[3] ?? 'walk';
const campaign: any = preset('L8-default' as any); campaign.seed = seed; campaign.settings.quality = 'low';
const w: any = await loadLevel('L8', seed, campaign, 0, { quality: 'low' } as any);
const bot: any = new LevelEightBot(w, 'complete'); const zoo = w.missions.l8;
const lines: string[] = []; w.events.on('dialogue.line', (e: any) => { lines.push(`${(w.tick / 60) | 0}s:${e.id}`); if (/lion/.test(e.id)) { const q = w.entities.get(1).transform, n = w.entities.get(zoo.state.keeperId).transform; console.log('LINE', e.id, 'courier', q.x.toFixed(1), q.z.toFixed(1), 'nadia', n.x.toFixed(1), n.z.toFixed(1), zoo.state.animals.map((id: number) => { const a = w.entities.get(id); return a ? `${a.civilian?.zooAnimal ?? a.archetype}@${a.transform.x.toFixed(0)},${a.transform.z.toFixed(0)}(d${Math.hypot(a.transform.x - q.x, a.transform.z - q.z).toFixed(0)})` : '-'; }).join(' ')); } });
let maxD = 0, maxAt = 0, doneAt = -1, inside = '';
const plaza = w.missions.def.anchors['central-plaza'];
for (let i = 0; i < 200 * 60; i++) {
  const p = w.entities.get(1).transform, k = w.entities.get(zoo.state.keeperId);
  followFrustum(w);
  let f = bot.sample();
  const t = w.tick - zoo.state.startedAt;
  if (mode === 'idle' && t < 600) f = emptyInput();
  if (mode === 'wander' && t > 300 && t < 1500) { f = emptyInput(); f.move = { x: -1, z: 0 } as any; }
  const before = { x: k?.transform.x ?? 0, z: k?.transform.z ?? 0 };
  w.applyInput(f, 'keyboard'); w.update();
  if (!k) break;
  const d = Math.hypot(k.transform.x - p.x, k.transform.z - p.z);
  const own = !zoo.state.guideWaiting && Math.hypot(k.transform.x - before.x, k.transform.z - before.z) > .02; // Nadia is actively leading this tick
  if (process.env.TRACE && t > 280 && t < 560 && t % 20 === 0) console.log(t, d.toFixed(1), own, zoo.state.guideWaiting, k.transform.x.toFixed(1), k.transform.z.toFixed(1), p.x.toFixed(1), p.z.toFixed(1));
  if (!zoo.breached && own && d > maxD) { maxD = d; maxAt = (t / 60) | 0; }
  if (doneAt < 0 && w.missions.state.steps.sanctuary.status === 'completed') {
    doneAt = (t / 60) | 0;
    const ids = zoo.roster().map((id: number) => w.entities.get(id)).filter((e: any) => e && e.health.current > 0);
    const inn = ids.filter((e: any) => Math.hypot(e.transform.x - plaza.x, e.transform.z - plaza.z) <= plaza.radius).length;
    inside = `nadiaIn ${Math.hypot(k.transform.x - plaza.x, k.transform.z - plaza.z) <= plaza.radius} groupIn ${inn}/${ids.length} playerIn ${Math.hypot(p.x - plaza.x, p.z - plaza.z) <= plaza.radius}`;
    break;
  }
}
console.log(`RESULT seed ${seed} ${mode} maxNadiaDist ${maxD.toFixed(1)} at ${maxAt}s done ${doneAt}s ${inside} lines ${lines.join(' ')}`);
process.exit(0);
