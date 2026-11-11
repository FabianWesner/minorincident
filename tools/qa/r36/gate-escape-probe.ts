/* eslint-disable @typescript-eslint/no-explicit-any -- diagnostic (r36-l8gates) */
// Usage: node --import tsx/esm tools/qa/r36/gate-escape-probe.ts [seconds] [press=x,z]
// Loads l8-before-gorilla natively, god mode, walks into the arena and then presses against the closed exit gate.
// Logs every tick on which the courier moves > 0.3 m, and any crossing of the exit gate plane (x = 82) while the gorilla lives.
import { loadLevel } from '../../sim-runner/levels';
import { readFixture } from '../fixture-io';
import { decodeSave } from '../../../src/sim/progression/Save';
import { emptyInput } from '../../../src/input/InputFrame';
const seconds = Number(process.argv[2] ?? 120);
const press = (process.argv[3] ?? '84,-30').split(',').map(Number);
const fx: any = readFixture('tests/fixtures/saves/qa/l8-before-gorilla.json.br'), decoded = decodeSave(JSON.stringify(fx.campaign));
if (decoded.status !== 'ok') throw new Error('decode');
const w: any = await loadLevel('L8', 1, decoded.save, 0, { quality: 'low' } as any);
w.missions.loadResume(fx.resume);
w.combat.damage.god = true;
const p = w.entities.get(1).transform;
const route = [[60, 12], [60, 0], [60, -8], [60, -30], [press[0], press[1]]];
let leg = 0, prev = { x: p.x, z: p.z }, crossings = 0;
const writers: string[] = [];
const origWrote = w.solids.wrote.bind(w.solids);
w.solids.wrote = (e: any, writer: string) => { if (e.id === 1) writers.push(writer); return origWrote(e, writer); };
for (let i = 0; i < seconds * 60; i++) {
  const f = emptyInput();
  const [tx, tz] = route[Math.min(leg, route.length - 1)];
  const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
  if (d < 1 && leg < route.length - 1) leg++;
  if (d > .05) f.move = { x: dx / d, z: dz / d };
  const tgt = w.missions.l8.state.arenas.find((a: any) => a.id === 'gorilla').ids.map((id: number) => w.entities.get(id)).find((e: any) => e && e.health.current > 0 && e.infected);
  if (tgt && leg === route.length - 1 && process.argv[4] !== 'nofire') { const ax = tgt.transform.x - p.x, az = tgt.transform.z - p.z, ad = Math.hypot(ax, az) || 1; f.aim = { x: ax / ad, z: az / ad }; f.aimPoint = { x: tgt.transform.x, z: tgt.transform.z }; f.aimSource = 'pointer'; f.strafe = true; f.mouseAttack = (w.tick % 20) < 10; }
  writers.length = 0;
  w.applyInput(f, 'keyboard'); w.update();
  const zoo = w.missions.l8, g = zoo.state.arenas.find((a: any) => a.id === 'gorilla');
  const boss = g.ids.map((id: number) => w.entities.get(id)).find((e: any) => e && e.health.current > 0);
  const step = Math.hypot(p.x - prev.x, p.z - prev.z);
  if (step > .3) console.log('JUMP t', w.tick, 'from', prev.x.toFixed(2), prev.z.toFixed(2), 'to', p.x.toFixed(2), p.z.toFixed(2), 'step', step.toFixed(2), 'writers', writers.join(','), w.solids.writers.get(w.entities.get(1)), 'boss', boss?.infected?.specialAttack?.move ?? '-', boss?.infected?.specialAttack?.stage ?? '', 'solids:', (() => { const out: string[] = []; w.infected.nav.visitSolids(p.x, p.z, 1.5, (b: any, id: any) => { if (Math.abs(b.y - 1) < 1.5) out.push(`${id}@${b.x.toFixed(2)},${b.z.toFixed(2)} h${b.halfX.toFixed(2)}x${b.halfZ.toFixed(2)}${b.yaw ? ' yaw' + b.yaw.toFixed(2) : ''}`); }); return out.join(' | '); })());
  if (boss && prev.x < 82 && p.x >= 82 && Math.abs(p.z + 31.77) < 4) { crossings++; console.log('ESCAPE t', w.tick, 'phase', g.phase, 'from', prev.x.toFixed(2), prev.z.toFixed(2), 'to', p.x.toFixed(2), p.z.toFixed(2), 'writers', writers.join(','), 'bossAt', boss.transform.x.toFixed(1), boss.transform.z.toFixed(1), boss.infected.specialAttack?.move ?? '-'); }
  if (i % 600 === 0) console.log('T', w.tick, 'p', p.x.toFixed(1), p.z.toFixed(1), 'phase', g.phase, 'boss', boss ? `${boss.health.current}@${boss.transform.x.toFixed(1)},${boss.transform.z.toFixed(1)}` : 'dead', 'obj', JSON.stringify(w.missions.state.objective?.text ?? '').slice(0, 60));
  prev = { x: p.x, z: p.z };
}
console.log('RESULT crossings', crossings, 'final', p.x.toFixed(2), p.z.toFixed(2));
w.dispose(); process.exit(0);
