// Metro debug: all five found, the group placed round the courier at the Metro foot. npx tsx tools/l5/metro.ts
import { l5Survivors } from '../../src/data/l5';
import { loadL5 } from '../sim-runner/l5Bots';

const l = await loadL5(4); const w = l.world, m = l.mission, s = m.state.l5!;
const place = (id: number, x: number, z: number) => { const e = w.entities.get(id)!; Object.assign(e.transform, { x, z }); if (id === 1) { w.physics.playerBody!.setTranslation({ x, y: e.transform.y, z }, true); w.physics.playerBody!.setNextKinematicTranslation({ x, y: e.transform.y, z }); Object.assign(w.previousPlayer!, e.transform); } w.spatial.set(id, x, z); };
w.combat!.damage.god = true; m.completeObjective('emerge'); for (let i = 0; i < 660; i++) w.update();
for (const d of l5Survivors) { const ring = m.def.anchors[`l5-ring-${d.key}`]; place(1, ring.x, ring.z); for (let i = 0; i < 75; i++) w.update(); }
for (const e of [...w.infected!.active]) w.infected!.release(e);
const foot = m.def.anchors['l5-metro-foot']; place(1, foot.x, foot.z - 2);
const fol = s.survivors.map(r => w.entities.get(r.id)!);
fol.forEach((f, i) => place(f.id, foot.x + (i - 2) * 1.5, foot.z + 1));
for (let i = 0; i < 600; i++) { w.update(); if (i % 60 === 0 || s.shutterAt && i % 20 === 0) console.log(i, s.phase, s.metroAt, s.shutterAt, JSON.stringify(s.survivors.map(r => r.status[0])), fol.map(f => `${f.transform.x.toFixed(1)},${f.transform.z.toFixed(1)} ${f.civilian?.state}`).join(' | ')); if (m.state.phase !== 'playing') break; }
