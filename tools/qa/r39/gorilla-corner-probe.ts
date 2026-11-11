/* eslint-disable @typescript-eslint/no-explicit-any -- diagnostic (r39-markers) */
// l8-before-gorilla: engage the arena, put the courier in the NE corner (80.6, -12.7) with her group packed between her and the gorilla;
// count the gorilla's telegraphed attacks and report its distance. r38-vqa: 4.3 m in 'chase' for 3 min, no attack.
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
const arena = w.missions.l8.state.arenas.find((a: any) => a.id === 'gorilla');
for (let i = 0; i < 1500 && arena.phase < 1; i++) { const f = emptyInput(); const t = i < 700 ? { x: 60, z: -8 } : { x: 70, z: -30 }; const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz); if (d > .3) f.move = { x: dx / d, z: dz / d }; w.applyInput(f, 'keyboard'); w.update(); }
console.log('arena phase', arena.phase, 'tick', w.tick);
const corner = { x: 80.6, z: -12.7 };
w.solids.relocate(w.entities.get(1), { x: corner.x, z: corner.z, y: p.y }, 'probe', 0, false);
const g = () => arena.ids.map((id: number) => w.entities.get(id)).find((e: any) => e?.infected && e.health.current > 0);
let attacks = 0; const moves: Record<string, number> = {};
w.events.on('telegraph', (e: any) => { if (e.sourceId === g()?.id) { attacks++; moves[e.move] = (moves[e.move] ?? 0) + 1; } });
let minGap = Infinity;
for (let i = 0; i < 3600; i++) {
  // Keep the group packed between the courier and the gorilla.
  if (i % 30 === 0) {
    const gor = g(); if (!gor) break;
    const dx = gor.transform.x - corner.x, dz = gor.transform.z - corner.z, d = Math.hypot(dx, dz) || 1;
    (w.missions.l8.followers() as any[]).forEach((e: any, n: number) => { const along = 1.6 + (n % 4) * .5, side = (Math.floor(n / 4) - 1.5) * .9; w.solids.relocate(e, { x: corner.x + dx / d * along - dz / d * side, z: corner.z + dz / d * along + dx / d * side, y: e.transform.y }, 'probe.group', 0, false); });
  }
  const f = emptyInput(); w.applyInput(f, 'keyboard'); w.update();
  const gor = g(); if (!gor) { console.log('gorilla dead at', i); break; }
  const gap = Math.hypot(gor.transform.x - p.x, gor.transform.z - p.z); minGap = Math.min(minGap, gap);
  if (i % 600 === 0) console.log(i, 'gap', gap.toFixed(1), 'state', gor.infected.state, 'attacks', attacks, 'phase', arena.phase, 'hp', gor.health.current);
}
console.log('attacks', attacks, JSON.stringify(moves), 'minGap', minGap.toFixed(1));
w.dispose();
