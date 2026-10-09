// L4 debug: shoot a group of five with a weapon id, print hits per target. Usage: npx tsx tools/l4/gun.ts [weapon.handgun|weapon.army-mg]
import { readFileSync } from 'node:fs';
import { emptyInput } from '../../src/input/InputFrame';
import { compositions } from '../../src/levels/compositions';
import { resolveCampaignMission } from '../../src/levels/missions';
import { preset } from '../../src/sim/progression/Campaign';
import { applyCampaign } from '../../src/sim/progression/apply';
import { SimWorld } from '../../src/sim/world/SimWorld';

const weaponId = process.argv[2] ?? 'weapon.handgun';
const w = new SimWorld(); await w.init();
const c = compositions.L4;
w.loadComposition(c, c.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), 4);
applyCampaign(w, preset('L4-default'));
const m = w.loadMission(resolveCampaignMission('L4', w.districts!)); m.begin();
while (m.state.l4!.phase === 'convoy') w.update();
m.completeObjective('quartermaster');
const p = w.entities.get(1)!.transform; Object.assign(p, { x: -20, z: -38.2 }); w.physics.playerBody!.setTranslation({ x: -20, y: p.y, z: -38.2 }, true); w.spatial.set(1, -20, -38.2);
const rack = w.entities.get(1)!.weapons!.RIGHT.rack, index = rack.findIndex(r => r.id === weaponId);
w.applyInput({ ...emptyInput(), selectedSlot: { side: 'RIGHT', index } }, 'keyboard'); for (let i = 0; i < 40; i++) w.update();
const ids = [[10, 0], [10.8, .5], [11.6, -.5], [10.4, 1], [12.2, 0]].map(([dx, dz]) => { const id = w.infected!.spawn('infected.runner', { x: -20 + dx, z: -38.2 + dz }, { yaw: 0 }); w.entities.get(id)!.infected!.l1!.pauseUntil = Number.MAX_SAFE_INTEGER; return id; });
const hits = new Map<number, number>(); w.events.on('combat.hit', e => { if (e.type === 'combat.hit' && e.sourceId === 1) hits.set(e.targetId, (hits.get(e.targetId) ?? 0) + 1); });
let shots = 0; w.events.on('combat.attack', e => { if (e.type === 'combat.attack' && e.sourceId === 1) shots++; });
for (let t = 0; t < 600; t++) {
  const target = ids.map(id => w.entities.get(id)!).filter(e => e.health.current > 0).sort((a, b) => a.transform.x - b.transform.x)[0]; if (!target) { console.log('all down at', t); break; }
  w.applyInput({ ...emptyInput(), attackTarget: { id: target.id, side: 'RIGHT' }, right: { down: t % 30 === 0, held: true, up: false }, attackInPlace: true }, 'keyboard'); w.update(); w.entities.get(1)!.health.current = 100;
}
console.log('shots', shots, 'hits', JSON.stringify([...hits]), 'hp', ids.map(id => w.entities.get(id)!.health.current), 'max', w.entities.get(ids[0])!.health.max, 'player', JSON.stringify(w.entities.get(1)!.transform));
{
  const q = w.combat!.query, t = w.entities.get(ids[2])!, from = { x: p.x, z: p.z }, dx = t.transform.x - from.x, dz = t.transform.z - from.z, d = Math.hypot(dx, dz), dir = { x: dx / d, z: dz / d };
  console.log('target', t.transform.x.toFixed(2), t.transform.z.toFixed(2), 'clear', q.clearDistance(from, dir, 22).toFixed(2), 'of', d.toFixed(2), 'ray', q.ray(1, from, dir, 22)?.id, 'state', t.infected?.l1?.mode, 'down', t.infected?.recoverAt);
  console.log('nearby ids', JSON.stringify([...w.spatial.query({ x: t.transform.x, z: t.transform.z, r: 1 }, [])]));
}
