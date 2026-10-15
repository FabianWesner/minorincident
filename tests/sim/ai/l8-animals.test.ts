import type { CoverWall } from '../../../src/sim/combat/HitQuery';
import { expect, test } from 'vitest';
import { Outbreak } from '../../../src/sim/outbreak/Outbreak';
import { WorldHumans } from '../../../src/sim/ai/Perception';
import { zooStaffLook } from '../../../src/data/zooStaff';
import { infectedDef } from '../../../src/data/infected';
import type { ZooSpecies } from '../../../src/sim/npc/types';
import { arena, step, spawn, hit } from './helpers';
async function fixture() {
  const w = await arena(); w.inspectionGhost = true;
  const courier = w.entities.get(1)!; Object.assign(courier.transform, { x: 30, z: 30 });
  w.physics.playerBody!.setTranslation(courier.transform, true); w.player!.locomotion.reset(); w.spatial.set(1, 30, 30);
  w.npcs!.civilians.outbreak = new Outbreak(w, { refuges: [] });
  w.infected!.configureL1v2(w.npcs!.civilians.outbreak.humans);
  w.infected!.director.ambientTarget = 0;
  return w;
}
const species: ZooSpecies[] = ['lion', 'gorilla', 'elephant', 'zebra', 'flamingo'];
test('T-E30-09-routine @E30-AC09 healthy animals walk their authored enclosure loop without a hostile brain', async () => {
  const w = await fixture();
  const id = w.npcs!.civilians.spawn('elephant', { x: 0, z: 0 }, { zooAnimal: 'elephant', waypoints: [{ x: 0, z: 0 }, { x: 2, z: 0 }] });
  const e = w.entities.get(id)!;
  for (let i = 0; i < 300 && e.civilian!.waypoint !== 0; i++) step(w, 1);
  expect(e.civilian!.waypoint).toBe(0); expect(e.transform.x).toBeGreaterThan(1.8);
  for (let i = 0; i < 300 && e.civilian!.waypoint !== 1; i++) step(w, 1);
  expect(e.civilian!.waypoint).toBe(1); expect(e.transform.x).toBeLessThan(.3); expect(e.infected).toBeUndefined();
});
for (const animal of species) {
  test(`T-E30-09-${animal} @E30-AC09 @E30-AC08 natural perceived bite, same-id 2.5–3.5s conversion and shared bar eligibility`, async () => {
    const w = await fixture(), outbreak = w.npcs!.civilians.outbreak!;
    const id = w.npcs!.civilians.spawn(animal, { x: 0, z: 0 }, { zooAnimal: animal, waypoints: [{ x: 0, z: 0 }] });
    const e = w.entities.get(id)!;
    expect(e.civilian?.model).toBe(`amb.${animal}`);
    expect(e.infected).toBeUndefined(); expect(e.faction).toBe('civilian');
    expect(new WorldHumans(w).get(id)?.kind).toBe('animal');
    const attacker = spawn(w, 'runner', -infectedDef(`infected.${animal}`).radius - .6, 0, 'idle');
    attacker.transform.yaw = 0;
    const start = { ...e.transform };
    for (let i = 0; i < 300 && !e.infection; i++) step(w, 1);
    const bite = w.events.events().find(ev => ev.type === 'outbreak.bite' && ev.targetId === id);
    expect(bite, JSON.stringify({ victim: e.civilian, biter: attacker.infected?.l1, events: w.events.events().filter(ev => ev.type === 'civilian.grabbed' || ev.type === 'civilian.saved') })).toMatchObject({ sourceId: attacker.id, targetId: id, turns: true });
    expect(e.infection).toBeDefined();
    expect(outbreak.humans.get(id)).toBeUndefined();
    const infection = { ...e.infection! };
    expect(infection.endsTick - infection.startedTick).toBeGreaterThanOrEqual(150);
    expect(infection.endsTick - infection.startedTick).toBeLessThanOrEqual(210);
    // Stop further combat to isolate the exact conversion frame/location.
    w.infected!.release(attacker);
    step(w, infection.endsTick - w.tick - 1); expect(e.infected).toBeUndefined();
    const beforeTurn = { ...e.transform };
    step(w, 1);
    expect(w.entities.get(id)).toBe(e); expect(e.archetype).toBe(`infected.${animal}`);
    expect(e.infected?.special).toBe(infectedDef(e.archetype).special);
    expect(e.infected?.speed).toBeGreaterThanOrEqual(infectedDef(e.archetype).speed * .8);
    expect(e.infected?.variant).toBe(infectedDef(e.archetype).asset);
    expect(e.transform.x).toBe(beforeTurn.x); expect(e.transform.z).toBe(beforeTurn.z); expect(e.transform.y).toBe(start.y);
    expect(e.civilian).toBeUndefined(); expect(e.infection).toBeUndefined(); expect(infectedDef(e.archetype).bar).toBe(true);
    expect(w.infected!.active.filter(a => a.id === id)).toHaveLength(1);
    expect(w.events.events().filter(ev => ev.type === 'civilian.turned' && ev.id === id)).toEqual([expect.objectContaining({ id, infectedId: id })]);
    expect(outbreak.stats.turned).toBe(1);
  });
}
test('T-E30-08-targets @E30-AC08 civilian/soldier/staff/animal bites use local perception, pets/children/corgi excluded', async () => {
  for (const category of ['civilian', 'soldier', 'staff', 'animal']) {
    const w = await fixture(), o = w.npcs!.civilians.outbreak!;
    const id = category === 'animal' ? w.npcs!.civilians.spawn('zebra', { x: 0, z: 0 }, { zooAnimal: 'zebra', waypoints: [{ x: 0, z: 0 }] }) : o.spawnPedestrian({ x: 0, z: 0 }, category === 'staff' ? zooStaffLook(0) : { role: category, model: category === 'soldier' ? 'npc.national-guard' : undefined });
    const pet = w.npcs!.civilians.spawn('dog', { x: 0, z: 5 }, { pet: 'dog' });
    const child = o.spawnPedestrian({ x: 1, z: 5 }, { child: true });
    expect(o.humans.get(pet)).toBeUndefined(); expect(o.humans.get(child)).toBeUndefined();
    const attacker = spawn(w, 'runner', -.9, 0, 'idle'); attacker.transform.yaw = 0;
    w.entities.get(id)!.civilian!.l1!.startleTicks = 300;
    for (let i = 0; i < 600 && !w.events.events().some(ev => ev.type === 'outbreak.bite' && ev.targetId === id); i++) step(w, 1);
    expect(w.events.events().find(ev => ev.type === 'outbreak.bite' && ev.targetId === id), JSON.stringify({ category, victim: w.entities.get(id), biter: attacker.infected?.l1, events: w.events.events().filter(ev => ev.type === 'civilian.grabbed' || ev.type === 'civilian.saved') })).toMatchObject({ sourceId: attacker.id });
  }
});
test('T-E30-09-rescue @E30-AC09 @E30-AC10 rescuing the grab prevents conversion; nearby animals are heard through solid walls but cannot be bitten through them', async () => {
  const w = await fixture(), o = w.npcs!.civilians.outbreak!;
  const id = w.npcs!.civilians.spawn('lion', { x: 0, z: 0 }, { zooAnimal: 'lion', waypoints: [{ x: 0, z: 0 }] });
  const e = w.entities.get(id)!, attacker = spawn(w, 'runner', -1.2, 0, 'idle'); attacker.transform.yaw = 0;
  for (let i = 0; i < 120 && e.civilian!.state !== 'grabbed'; i++) step(w, 1);
  expect(e.civilian!.state).toBe('grabbed');
  hit(w, attacker.id); step(w, 1);
  expect(w.events.events().some(ev => ev.type === 'civilian.saved' && ev.id === id)).toBe(true);
  w.infected!.release(attacker); step(w, 240);
  expect(e.infected).toBeUndefined(); expect(e.infection).toBeUndefined();
  expect(w.events.events().some(ev => ev.type === 'civilian.saved' && ev.id === id)).toBe(true);
  const blocked = spawn(w, 'runner', -1.2, 0, 'idle');
  o.humans.invalidate();
  w.infected!.l1!.los.register({ id: 'wall', source: 'building', active: true, shape: { kind: 'aabb', min: { x: -.6, z: -20 }, max: { x: -.5, z: 20 } } });
  const wall: CoverWall = { x: -.55, y: 1.5, z: 0, halfX: .05, halfY: 1.5, halfZ: 20 };
  (w.combat!.query.walls as CoverWall[]).push(wall);
  w.events.emit({ type: 'world.blocker.changed', tick: w.tick, id: 990_125, wall, blocked: true });
  expect(w.infected!.l1!.closest(blocked, 0)?.id).toBe(id);
  expect(w.infected!.l1!.lineOfSight(blocked.transform, e.transform)).toBe(false);
  step(w, 120);
  expect(e.infection).toBeUndefined();
});
test('T-E30-17-animal @E30-AC17 serialized bitten state resumes remaining timer once; duplicate bite does not restart it', async () => {
  const w = await fixture(), o = w.npcs!.civilians.outbreak!;
  const id = w.npcs!.civilians.spawn('elephant', { x: 0, z: 0 }, { zooAnimal: 'elephant' });
  const e = w.entities.get(id)!;
  o.infect(e, 0); const until = e.infection!.endsTick; step(w, 90);
  const state = JSON.parse(JSON.stringify(e)); Object.assign(e, state);
  o.load(JSON.parse(JSON.stringify(o.snapshot()))); o.infect(e, 0);
  expect(e.infection!.endsTick).toBe(until);
  const remaining = until - w.tick; w.tick += 123; w.npcs!.restore(123);
  expect(e.infection!.endsTick - w.tick).toBe(remaining);
  step(w, remaining); expect(e.archetype).toBe('infected.elephant');
  step(w, 90); expect(o.stats.turned).toBe(1);
});

test('T-E30-09-cap @E30-AC09 @E30-AC11 bitten zoo victims cannot create duplicate entities or exceed the shared infected cap', async () => {
  const w = await fixture(), o = w.npcs!.civilians.outbreak!;
  w.infected!.director.levelCap = 1;
  const id = w.npcs!.civilians.spawn('zebra', { x: 0, z: 0 }, { zooAnimal: 'zebra', waypoints: [{ x: 0, z: 0 }] });
  const attacker = spawn(w, 'runner', -1.2, 0, 'idle'); attacker.transform.yaw = 0;
  step(w, 600);
  expect(w.entities.get(id)!.civilian!.state).toBe('finished');
  expect(w.entities.get(id)!.infected).toBeUndefined(); expect(o.humans.get(id)).toBeUndefined();
  expect(w.infected!.director.count).toBe(1); expect(o.stats.turned).toBe(0);
  expect(w.events.events().find(ev => ev.type === 'outbreak.bite' && ev.targetId === id)).toMatchObject({ turns: false });
});

test('T-E30-09-healthy-hit @E30-AC09 @E30-AC06 healthy animals stay huntable after a harmless player hit, without human protest or magical infection', async () => {
  const w = await fixture(), o = w.npcs!.civilians.outbreak!;
  const id = w.npcs!.civilians.spawn('lion', { x: 0, z: 0 }, { zooAnimal: 'lion', waypoints: [{ x: 0, z: 0 }] });
  const animal = w.entities.get(id)!;
  expect(o.liveCivilians()).toBe(0);
  hit(w, id); w.npcs!.civilians.annoy(animal, { x: 1, z: 0 }); step(w, 180);
  expect(animal.civilian!.state).toBe('calm'); expect(animal.infection).toBeUndefined(); expect(animal.infected).toBeUndefined();
  expect(o.humans.get(id)?.kind).toBe('animal');
  expect(w.events.events().some(ev => ev.type === 'civilian.bark' && ev.id === id)).toBe(false);
});
