// r42 alpha-mix native probe: every route Alpha spawns, engages (chase/attack within 60 m) and attacks, high and low quality.
// node --import tsx/esm tools/qa/r42/alpha-mix-probe.ts [--levels L3,L6,L7] [--seed 1] [--quality high,low] [--seconds 900]
import { parseArgs } from 'node:util';
import { runLevel, type RunnerLevel } from '../../sim-runner/levels';
import type { SimWorld } from '../../../src/sim/world/SimWorld';

const { values } = parseArgs({ options: { levels: { type: 'string', default: 'L3,L6,L7' }, seed: { type: 'string', default: '1' }, quality: { type: 'string', default: 'high,low' }, seconds: { type: 'string', default: '900' } } });
interface Row { id: number; type: string; spawnT: number; x: number; z: number; engageT: number; attackT: number; specials: Set<string>; deadT: number; minDist: number }
let failed = 0;
for (const level of values.levels!.split(',') as RunnerLevel[]) for (const quality of values.quality!.split(',') as ('high' | 'low')[]) {
  const rows = new Map<number, Row>(); let peak = 0, cap = 0;
  const observe = (w: SimWorld) => {
    const p = w.entities.get(1)!.transform; let alive = 0;
    for (const e of w.infected!.active) {
      if (e.health.current > 0 && !e.hidden) alive++;
      if (e.archetype !== 'infected.alpha' || !e.infected?.alphaType) continue;
      let r = rows.get(e.id);
      if (!r) rows.set(e.id, r = { id: e.id, type: e.infected.alphaType, spawnT: w.tick, x: Math.round(e.transform.x), z: Math.round(e.transform.z), engageT: -1, attackT: -1, specials: new Set(), deadT: -1, minDist: 1e9 });
      const d = Math.hypot(e.transform.x - p.x, e.transform.z - p.z); r.minDist = Math.min(r.minDist, d);
      if (r.engageT < 0 && (e.infected.state === 'chase' || e.infected.state === 'attack') && d < 60) r.engageT = w.tick;
      if (r.deadT < 0 && e.health.current <= 0) r.deadT = w.tick;
      if (process.env.TRACE && w.tick % 60 === 0 && d < 80) console.log(`    t${w.tick} #${e.id} ${r.type} ${e.infected.state} d=${d.toFixed(1)} a=(${e.transform.x.toFixed(0)},${e.transform.z.toFixed(0)}) p=(${p.x.toFixed(0)},${p.z.toFixed(0)}) tgt=${e.infected.targetId} heard=${e.infected.heardTargetId} hp=${e.health.current.toFixed(0)}`);
    }
    peak = Math.max(peak, alive); cap = w.infected!.director.cap;
  };
  const report = await runLevel(level, 'complete', Number(values.seed), Number(values.seconds), 'auto', undefined, undefined, 0, { quality, beforeBegin: w => { w.events.on('l3.squad-lost', ev => { if (ev.type !== 'l3.squad-lost') return; const o = w.entities.get(ev.id); const near = [...rows.values()].map(r => { const a = w.entities.get(r.id); return a && o ? `${r.type}@${Math.hypot(a.transform.x - o.transform.x, a.transform.z - o.transform.z).toFixed(1)}m` : ''; }).join(' '); console.log(`    squad lost t${w.tick} id${ev.id} ${ev.cause} x=${o?.transform.x.toFixed(0)} alphas: ${near}`); }); w.events.on('infected.attack', ev => { if (ev.type !== 'infected.attack') return; const r = rows.get(ev.sourceId); if (r && r.attackT < 0) r.attackT = w.tick; }); w.events.on('infected.special', ev => { if (ev.type !== 'infected.special' || ev.stage !== 'active') return; const r = rows.get(ev.sourceId); if (!r) return; r.specials.add(ev.move); if (r.attackT < 0) r.attackT = w.tick; }); }, stopWhen: w => { observe(w); return false; } });
  console.log(`== ${level} ${quality} seed ${values.seed}: ${report.outcome}, t=${report.time.toFixed(0)}s, peak alive ${peak} (cap ${cap})`);
  for (const r of rows.values()) console.log(`  alpha#${r.id} ${r.type} at (${r.x},${r.z}) spawn t${r.spawnT} engage ${r.engageT >= 0 ? 't' + r.engageT : 'NO'} attack ${r.attackT >= 0 ? 't' + r.attackT : 'NO'} specials [${[...r.specials]}] minDist ${r.minDist.toFixed(1)} ${r.deadT >= 0 ? 'killed t' + r.deadT : 'alive'}`);
  if (!rows.size || [...rows.values()].some(r => r.attackT < 0 && r.deadT < 0)) { failed++; console.log('  FLAG: an Alpha did not engage/attack'); }
}
process.exit(failed ? 1 : 0);
