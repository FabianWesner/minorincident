/* eslint-disable @typescript-eslint/no-explicit-any -- diagnostic (r42-arenas) */
// l10-dispersal-console fixture: where are the console, the courier, the Mega, which states are set; then run the courier east (kite) and report
// how far from the console she gets. Usage: tsx l10-probe.ts [dirx dirz] [seconds]
import { loadLevel } from '../../sim-runner/levels';
import { readFixture } from '../fixture-io';
import { decodeSave } from '../../../src/sim/progression/Save';
import { emptyInput } from '../../../src/input/InputFrame';
const dir = { x: Number(process.argv[2] ?? 1), z: Number(process.argv[3] ?? 0) }, seconds = Number(process.argv[4] ?? 60);
const fx: any = readFixture('tests/fixtures/saves/qa/l10-dispersal-console.json.gz'), decoded = decodeSave(JSON.stringify(fx.campaign));
if (decoded.status !== 'ok') throw new Error('decode');
const w: any = await loadLevel('L10', 1, decoded.save, 0, { quality: 'low' } as any);
w.missions.loadResume(decoded.save.cureResume);
w.combat.damage.god = true;
const pe = w.entities.get(1), p = pe.transform, c = w.missions.def.anchors['cure-console'];
const st = w.missions.state.states;
console.log('phase', w.missions.state.phase, 'hp', pe.health.current, 'tick', w.tick); console.log('console', JSON.stringify(c), 'player', p.x.toFixed(1), p.z.toFixed(1), 'states', Object.keys(st).filter(k => st[k]).join(','));
console.log('relocate', w.solids.relocate(pe, { x: c.x + Number(process.env.RX ?? 25), z: c.z + Number(process.env.RZ ?? 0), y: p.y }, 'probe', 0, false));
let maxD = 0;
for (let i = 0; i < seconds * 60; i++) {
  const f: any = emptyInput(); f.move = dir; w.applyInput(f, 'keyboard'); w.update();
  const d = Math.hypot(p.x - c.x, p.z - c.z); maxD = Math.max(maxD, d);
  if (i % 300 === 0) { const m = w.megaPursuit?.entity(); console.log(w.tick, 'her', (p.x - c.x).toFixed(1), (p.z - c.z).toFixed(1), 'd', d.toFixed(1), 'mega', m ? [(m.transform.x - c.x).toFixed(1), (m.transform.z - c.z).toFixed(1), Math.round(m.health.current)].join('/') : '-', 'installed', st['cure-installed'], 'objective', w.missions.state.steps?.mega?.status); }
}
console.log('max distance from console', maxD.toFixed(1));
w.dispose();
