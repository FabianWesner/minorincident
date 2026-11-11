/* eslint-disable @typescript-eslint/no-explicit-any -- diagnostic (r36-l8gates) */
// Usage: node --import tsx/esm tools/qa/r36/gate-squeeze-probe.ts
// l8-before-gorilla: the courier stands against the closed gorilla exit gate (x = 82) and a solid (a thrown prop) appears on her
// from the arena side, or a 3 m knockback / swept push shoves her east. Prints where she ends: x > 82 = through the gate.
import { loadLevel } from '../../sim-runner/levels';
import { readFixture } from '../fixture-io';
import { decodeSave } from '../../../src/sim/progression/Save';
import { emptyInput } from '../../../src/input/InputFrame';
const fx: any = readFixture('tests/fixtures/saves/qa/l8-before-gorilla.json.br'), decoded = decodeSave(JSON.stringify(fx.campaign));
if (decoded.status !== 'ok') throw new Error('decode');
const w: any = await loadLevel('L8', 1, decoded.save, 0, { quality: 'low' } as any);
w.missions.loadResume(fx.resume);
w.combat.damage.god = true;
const p = w.entities.get(1).transform;
const step = (n: number) => { for (let i = 0; i < n; i++) { w.applyInput(emptyInput(), 'keyboard'); w.update(); } };
// Engage the arena so the exit gate is closed.
const arena = w.missions.l8.state.arenas.find((a: any) => a.id === 'gorilla');
for (let i = 0; i < 1500 && arena.phase < 1; i++) { const f = emptyInput(); const t = i < 700 ? { x: 60, z: -8 } : { x: 70, z: -30 }; const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz); if (d > .3) f.move = { x: dx / d, z: dz / d }; w.applyInput(f, 'keyboard'); w.update(); }
console.log('arena phase', arena.phase, 'tick', w.tick);
const place = (x: number, z: number) => { Object.assign(p, { x, z }); w.solids.relocate(w.entities.get(1), { x, z, y: p.y }, 'probe', 0, false); step(2); };
for (const z of [-30, -29, -33]) {
  place(81.38, z);
  const before = { x: p.x, z: p.z };
  w.solids.setBarrier('probe.prop', { x: 80.95, z, y: 1, halfX: .5, halfZ: .5, halfY: 1 }); step(3);
  console.log('prop-squeeze z', z, 'from', before.x.toFixed(2), 'to', p.x.toFixed(2), p.z.toFixed(2), p.x > 82 ? 'THROUGH' : 'held');
  w.solids.setBarrier('probe.prop', null); step(2);
  place(81.38, z);
  w.knockback(w.entities.get(1), { x: 1, z: 0 }, 3); step(2);
  console.log('knockback3 z', z, 'to', p.x.toFixed(2), p.z.toFixed(2), p.x > 82 ? 'THROUGH' : 'held');
  place(81.38, z);
  w.knockback(w.entities.get(1), { x: 1, z: 0 }, 3, 12); step(14);
  console.log('slide3 z', z, 'to', p.x.toFixed(2), p.z.toFixed(2), p.x > 82 ? 'THROUGH' : 'held');
  // The gorilla body steps onto her from the arena side.
  const g = arena.ids.map((id: number) => w.entities.get(id)).find((e: any) => e?.infected && e.health.current > 0);
  if (g) {
    for (const gx of [80.6, 80.3, 80.0]) {
      place(81.38, z);
      Object.assign(g.transform, { x: gx - .3, z }); w.solids.relocate(g, { x: gx - .3, z, y: g.transform.y }, 'probe', 1, false);
      g.transform.x = gx; w.solids.wrote(g, 'probe.step'); step(1);
      console.log('gorilla-step r', g.combat.radius, 'gx', gx, 'z', z, 'courier', p.x.toFixed(2), p.z.toFixed(2), 'gorilla', g.transform.x.toFixed(2), p.x > 82 ? 'THROUGH' : 'held');
      Object.assign(g.transform, { x: 70, z: -30 }); w.solids.relocate(g, { x: 70, z: -30, y: g.transform.y }, 'probe', 3, false); step(1);
    }
  }
}
w.dispose(); process.exit(0);
