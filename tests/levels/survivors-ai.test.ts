import { readFileSync } from 'node:fs';
import { afterEach, expect, test } from 'vitest';
import { wreckRoofHeight } from '../../src/levels/districts/wreckRoofHeight';
import { markerSurfaceY, ObjectiveMarker } from '../../src/render/ObjectiveMarker';
import { groundAgent } from '../../src/sim/locomotion/AgentMotion';
import { compositions } from '../../src/levels/compositions';
import { resolveCampaignMission } from '../../src/levels/missions';
import { l5Dressing } from '../../src/levels/L5/layout';
import { newCampaign, preset } from '../../src/sim/progression/Campaign';
import { applyCampaign } from '../../src/sim/progression/apply';
import { completeCampaignLevel } from '../../src/sim/progression/carryover';
import { decodeSave } from '../../src/sim/progression/Save';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { loadL6 } from '../../tools/sim-runner/l6Bots';
import { loadL5 } from '../../tools/sim-runner/l5Bots';

const worlds: SimWorld[] = [];
afterEach(() => { worlds.splice(0).forEach(w => w.dispose()); });

test('@E23 @E24 @E29 L5 street firearm is collected once and keeps its identity through save/reload, L6, L7 and L8', async () => {
  const { world: w, mission: m } = await loadL5(1); worlds.push(w);
  const firearms = [...w.entities.iterate()].filter(e => e.pickup && 'actionId' in e.pickup && e.pickup.survivorOnly);
  expect(firearms).toHaveLength(l5Dressing.filter(e => e.kind === 'weapon').length);
  expect(w.districts!.districts[0].layout.placements.filter(p => p.id.startsWith('l5-weapon-'))).toHaveLength(0);
  for (const infected of [...w.infected!.active]) w.infected!.release(infected);
  m.completeObjective('emerge');
  const r = m.state.l5!.survivors[0], e = w.entities.get(r.id)!;
  e.hidden = false; r.status = 'following'; e.civilian!.survivor!.mode = 'follow';
  const gun = firearms[0], pickup = gun.pickup!;
  Object.assign(e.transform, gun.transform, { x: gun.transform.x + 1, y: .7 }); w.spatial.set(e.id, e.transform.x, e.transform.z);
  // The real outbreak tick, rather than a direct arm helper call, picks it up.
  w.update(); expect(e.civilian!.ally?.actionId).toBe('actionId' in pickup ? pickup.actionId : '');
  const actionId = e.civilian!.ally!.actionId;
  expect(w.entities.get(gun.id)).toBeUndefined();
  e.civilian!.ally!.nextAttack = w.tick + 9000; e.civilian!.ally!.reloadUntil = w.tick + 9000;
  const checkpoint = structuredClone(e); r.status = 'sheltered';
  const save = preset('L5-default');
  const result = { time: 1, kills: 0, knockdowns: 0, damage: 0, deaths: 0, rescued: 1, optionalObjectives: [], ...m.l5!.result() };
  completeCampaignLevel(save, 5, result, w);
  const decoded = decodeSave(JSON.stringify(save)); expect(decoded.status).toBe('ok');
  if (decoded.status !== 'ok') throw new Error('invalid campaign save');
  const next = new SimWorld(); worlds.push(next); await next.init();
  next.loadComposition(compositions.L6, [JSON.parse(readFileSync('public/assets/layouts/D-SUBWAY.layout.json', 'utf8'))], 1);
  applyCampaign(next, decoded.save);
  const six = next.loadMission(resolveCampaignMission('L6', next.districts!)); six.begin();
  const carried = next.entities.get(e.id)!;
  expect(carried.civilian!.ally).toMatchObject({ actionId, gun: checkpoint.civilian!.ally!.gun });
  expect(carried.civilian!.ally!.nextAttack).toBe(next.tick);
  expect(carried.appearance!.handProp).toBe(checkpoint.appearance!.handProp);
  expect(six.state.l6!.survivors.filter(q => q.id === e.id)).toHaveLength(1);
  six.state.l6!.survivors.find(q => q.id === e.id)!.status = 'out';
  const escaped = six.l6!.result().escapedSurvivors;
  const later = new SimWorld(); worlds.push(later); await later.init();
  later.loadComposition(compositions.L7, [JSON.parse(readFileSync('public/assets/layouts/D-FAIR.layout.json', 'utf8'))], 1, null, escaped);
  applyCampaign(later, newCampaign());
  later.l7Encounters!.prepare();
  expect(later.entities.get(e.id)!.civilian!.ally?.actionId).toBe(actionId);
  expect(later.entities.get(e.id)!.appearance!.handProp).toBe(carried.appearance!.handProp);
  const zoo = new SimWorld(); worlds.push(zoo); await zoo.init();
  zoo.loadComposition(compositions.L8, [JSON.parse(readFileSync('public/assets/layouts/D-ZOO.layout.json', 'utf8'))], 1, null, [later.entities.get(e.id)!]);
  applyCampaign(zoo, preset('L8-default'));
  zoo.loadMission(resolveCampaignMission('L8', zoo.districts!)).begin();
  expect(zoo.entities.get(e.id)!.civilian!.ally?.actionId).toBe(actionId);
  expect(zoo.entities.get(e.id)!.appearance!.handProp).toBe(carried.appearance!.handProp);
}, 120_000);

test('@E08 @E23 wreck roof support keeps corgi paws above the bus, and the objective ring on the courier layer', async () => {
  const { world: w, mission: m } = await loadL5(1); worlds.push(w);
  const d = w.districts!.districts[0], bus = d.layout.placements.find(p => p.id === 'l5-bus-68')!;
  const roof = d.decay.colliders.find(c => c.id.startsWith(`${bus.id}/`))!.aabb;
  const x = (roof.min[0] + roof.max[0]) / 2, z = (roof.min[2] + roof.max[2]) / 2, y = wreckRoofHeight(bus, x, z)!;
  expect(y).toBeGreaterThan(roof.max[1] + .5);
  const corgi = [...w.entities.iterate()].find(e => e.companion)!;
  Object.assign(corgi.transform, { x, z, y: roof.max[1] + .3, yaw: 0 }); groundAgent(w, corgi);
  expect(corgi.transform.y - .3).toBeGreaterThan(roof.max[1] + .5);
  // Centre past the rear roof edge, front paws still supported on the roof.
  corgi.transform.x = roof.min[0] - .2; groundAgent(w, corgi);
  expect(corgi.transform.y - .3).toBeGreaterThan(roof.max[1] + .5);
  corgi.transform.x = x; corgi.transform.z = z + 1.15; groundAgent(w, corgi);
  expect(corgi.transform.y - .3, 'paws beside the centre line also support a roof edge').toBeGreaterThan(roof.max[1]);
  corgi.transform.x = roof.min[0] - 1; corgi.transform.z = z; groundAgent(w, corgi);
  expect(corgi.transform.y - .3).toBeLessThan(y);
  Object.assign(w.entities.get(1)!.transform, { x, z, y: y + .72 });
  const anchor = { x, z, y: 0 };
  expect(markerSurfaceY(w, anchor)).toBeCloseTo(y, 5);
  const marker = new ObjectiveMarker(w); m.state.marker = 'qa-bus'; m.def.anchors['qa-bus'] = { ...anchor, radius: 1 };
  marker.update(); expect(marker.children[0]).toMatchObject({ material: { depthTest: true } }); expect(marker.position.y + marker.children[0].position.y).toBeCloseTo(y + .08, 5); marker.dispose();
  w.entities.get(1)!.transform.y = .72;
  expect(markerSurfaceY(w, anchor), 'street layer must never jump to a roof overhead').toBe(0);
}, 120_000);


test.each(['L5', 'L6', 'L7', 'L8'] as const)('@E08-AC02 %s production formation/routine cannot swallow an attacked survivor reaction', async level => {
  let w: SimWorld;
  if (level === 'L5') w = (await loadL5(1)).world;
  else if (level === 'L6') w = (await loadL6(1)).world;
  else {
    w = new SimWorld(); await w.init();
    w.loadComposition(compositions[level], [JSON.parse(readFileSync(`public/assets/layouts/${level === 'L8' ? 'D-ZOO' : 'D-FAIR'}.layout.json`, 'utf8'))], 1);
    if (level === 'L7') w.l7Encounters!.prepare();
    else { applyCampaign(w, preset('L8-default')); w.loadMission(resolveCampaignMission('L8', w.districts!)).begin(); }
  }
  worlds.push(w);
  for (const o of [...w.infected!.active]) w.infected!.release(o);
  const e = [...w.entities.iterate()].find(e => e.civilian?.survivor && !e.civilian.ally)!;
  e.hidden = false; e.civilian!.survivor!.mode = 'follow';
  const at = level === 'L6' ? { x: 50, z: 15, y: 1.3 } : { x: 10, z: -39, y: .7 };
  expect(w.solids.relocate(e, { ...at, yaw: 0 }, 'test.attacked-follower')).toBe(true);
  const zid = w.infected!.spawn('infected.runner', { x: at.x - 2, z: at.z });
  const attacker = w.entities.get(zid)!; attacker.combat!.staggerUntil = w.tick + 1000;
  const from = { ...e.transform };
  w.events.emit({ type: 'infected.attack', tick: w.tick, sourceId: zid, targetId: e.id, attackId: 10, special: 'melee', amount: 0 });
  for (let i = 0; i < 30; i++) w.update();
  expect(e.civilian!.state).toBe('flee');
  expect(e.transform.x - from.x).toBeGreaterThan(.2);
  expect(e.civilian!.story?.clip).not.toBe('npc-cower');
}, 120_000);


test('@E24 an attacked injured follower reacts within 0.5 seconds while retaining the authored 1.4 m/s injury speed', async () => {
  const { world: w, mission: m } = await loadL6(1); worlds.push(w);
  const row = m.state.l6!.survivors.find(r => r.injured)!, e = w.entities.get(row.id)!;
  expect(w.solids.relocate(e, { x: 50, y: 1.3, z: 15, yaw: 0 }, 'test.injured-flight')).toBe(true);
  const zid = w.infected!.spawn('infected.runner', { x: 48, z: 15 }); w.entities.get(zid)!.combat!.staggerUntil = 1000;
  w.events.emit({ type: 'infected.attack', tick: w.tick, sourceId: zid, targetId: e.id, attackId: 1, special: 'melee', amount: 0 });
  let speed = 0;
  for (let i = 0; i < 30; i++) { w.update(); speed = Math.max(speed, e.motion?.speed ?? 0); }
  expect(e.civilian!.state).toBe('flee'); expect(e.transform.x).toBeGreaterThan(50.2);
  expect(speed).toBeLessThanOrEqual(1.4 + 1e-6);
});
