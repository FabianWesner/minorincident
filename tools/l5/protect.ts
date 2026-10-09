// Protection debug: a survivor, an infected 3 m away, the courier shoots the grabber inside the 1 s window. npx tsx tools/l5/protect.ts [px] [protect 0|1]
import { emptyInput } from '../../src/input/InputFrame';
import { loadL5 } from '../sim-runner/l5Bots';

const dx = Number(process.argv[2] ?? 3), protect = process.argv[3] !== '0';
const l = await loadL5(5); const w = l.world, m = l.mission, s = m.state.l5!, ai = w.infected!;
const place = (id: number, x: number, z: number) => { const e = w.entities.get(id)!; Object.assign(e.transform, { x, z }); if (id === 1) { w.physics.playerBody!.setTranslation({ x, y: e.transform.y, z }, true); w.physics.playerBody!.setNextKinematicTranslation({ x, y: e.transform.y, z }); Object.assign(w.previousPlayer!, e.transform); } w.spatial.set(id, x, z); };
w.combat!.damage.god = true; m.completeObjective('emerge'); for (let i = 0; i < 660; i++) w.update(); for (const e of [...ai.active]) ai.release(e);
const ring = m.def.anchors['l5-ring-mia']; place(1, ring.x, ring.z); for (let i = 0; i < 70; i++) w.update();
const mia = w.entities.get(s.survivors.find(r => r.key === 'mia')!.id)!;
place(1, mia.transform.x + 30, mia.transform.z); w.player!.setCheckpoint(w.entities.get(1)!.transform);
const g = ai.spawn('infected.runner', { x: mia.transform.x - 3, z: mia.transform.z }, { yaw: 0 });
const ev: string[] = []; for (const type of ['civilian.grabbed', 'outbreak.bite', 'civilian.saved', 'civilian.turned', 'combat.hit'] as const) w.events.on(type, () => ev.push(`${type}@${w.tick}`));
let shot = false, shotAt = 0;
for (let i = 0; i < 6 * 60; i++) {
  w.update();
  const gr = w.entities.get(g)!;
  if (protect && ev.some(x => x.startsWith('civilian.grabbed')) && !shot) { shot = true; shotAt = i; place(1, mia.transform.x + dx, mia.transform.z); }
  if (shot && i % 1 === 0) w.applyInput({ ...emptyInput(), attackTarget: { id: g, side: 'RIGHT' }, right: { down: i === shotAt + 1, held: true, up: false }, attackInPlace: true }, 'keyboard');
  if (i % 30 === 0) console.log(`i=${i} inf (${gr.transform.x.toFixed(1)},${gr.transform.z.toFixed(1)}) hp=${gr.health.current.toFixed(0)} mode=${gr.infected?.l1?.mode} mia (${mia.transform.x.toFixed(1)},${mia.transform.z.toFixed(1)}) state=${mia.civilian?.state}`);
}
console.log(ev.join(' '));
