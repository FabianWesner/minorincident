import { expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { emptyInput } from '../../src/input/InputFrame';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { loadLevel } from '../../tools/sim-runner/levels';
import { loadL4 } from '../../tools/sim-runner/l4Bots';
import { l4PerimeterWalls } from '../../src/data/l4Perimeter';
import { actorRadius } from '../../src/sim/world/SolidRegistry';
import { closeBarrierJoints } from '../../src/levels/barrierJoints';
import { levelThreeLayouts } from '../../src/levels/L3/layout';
import { highwayColliders, highwayPoint } from '../../src/levels/L3/highway';

// PO 10-19: every kind uses the same perimeter, including direct scripted displacement.
test('L4 perimeter rejects placement and swept passage for every actor kind', async () => {
  const { world: w, mission: m } = await loadL4(1);
  try {
    w.combat!.damage.god = true;
    while (m.state.l4!.phase === 'convoy') w.update();
    m.completeObjective('quartermaster');
    while (!m.state.l4!.turnAt) w.update();
    // A courier who left during the calm interval cannot make the visible wall intangible for everyone else.
    const perimeter = m.l4 as unknown as { perimeter(on: boolean): void };
    perimeter.perimeter(false);
    Object.assign(w.entities.get(1)!.transform, { x: -5, z: 16 });
    perimeter.perimeter(true);
    expect(w.solids.clear({ x: l4PerimeterWalls[3].x, y: .7, z: 16 }, .35, 1, false)).toBe(false);
    const actors = [w.entities.get(1)!, ...['civilian', 'soldier', 'companion', 'infected', 'escort'].map(role => {
      const kind = role === 'soldier' ? 'civilian' : role;
      const e = w.entities.create({ kind, archetype: `probe.${role}`, faction: 'survivor', health: { current: 100, max: 100 }, transform: { x: -10.3, y: .7, z: 16, yaw: 0 }, [kind]: {} });
      return e;
    })];
    for (const e of actors) {
      const wall = l4PerimeterWalls[3];
      Object.assign(e.transform, { x: wall.x - 1, y: .7, z: 16 });
      expect(w.solids.clear({ x: wall.x, y: .7, z: 16 }, actorRadius(e), e.id, false), e.archetype).toBe(false);
      expect(w.solids.sweep(e, { x: 1, z: 0 }, 2, actorRadius(e), false, false), e.archetype).toBeLessThan(.7);
    }
  } finally { w.dispose(); }
}, 180_000);

test('NPC spawn admission leaves 0.8 m around a reserved player start', async () => {
  const w = await loadLevel('L1', 1);
  try {
    const p = w.entities.get(1)!, at = { x: p.transform.x + .72, z: p.transform.z };
    const e = w.entities.get(w.npcs!.civilians.spawn('cashier', at, { waypoints: [at] }))!;
    expect(Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z)).toBeGreaterThanOrEqual(.8);
  } finally { w.dispose(); }
}, 120_000);

test('L1 shutter brings an outside companion inside before sealing, with a short transition', async () => {
  const w = await loadLevel('L1', 1);
  try {
    const m = w.missions!, door = m.def.anchors['fire-bay-door'], inside = m.def.anchors['fire-bay-trigger'];
    const p = w.entities.get(1)!, dog = [...w.entities.iterate()].find(e => e.companion)!;
    w.solids.relocate(p, { ...inside, y: p.transform.y }, 'test.inside', 1, false);
    const dx = inside.x - door.x, dz = inside.z - door.z, length = Math.hypot(dx, dz), nx = dx / length, nz = dz / length;
    Object.assign(dog.transform, { x: door.x - nx * 2, z: door.z - nz * 2 }); w.spatial.set(dog.id, dog.transform.x, dog.transform.z);
    m.setGate('fire-shutter', false);
    expect(m.state.gates['fire-shutter']).toBe(false);
    expect((dog.transform.x - door.x) * nx + (dog.transform.z - door.z) * nz).toBeGreaterThanOrEqual(.4);
    expect(dog.companion!.transitionUntil).toBe(w.tick + 12);
    for (let i = 0; i < 13; i++) w.update();
    expect(dog.hidden).not.toBe(true);
    expect(w.infected!.nav.clear(door.x, door.z, .35)).toBe(false);
    m.loadCheckpoint('start');
    expect(m.state.gates['fire-shutter']).toBe(true);
    expect(w.infected!.nav.clear(door.x, door.z, .35)).toBe(true);
  } finally { w.dispose(); }
}, 120_000);

test('L3 all four ramp rail joints meet visible solid caps within 2 cm', () => {
  const layout = levelThreeLayouts([JSON.parse(readFileSync('public/assets/layouts/D-CORRIDOR.layout.json', 'utf8'))])[0];
  const ramps = layout.placements.filter(p => p.assetId === 'kit.highway-onramp');
  const caps = ramps.flatMap(p => highwayColliders(p).filter(c => c.id.includes('/highway-joint-')));
  expect(caps).toHaveLength(4);
  for (const ramp of ramps) for (const side of [-1, 1]) {
    const cap = caps.find(p => p.id === `${ramp.id}/highway-joint-${side}`)!;
    const points = [highwayPoint(ramp, 0, side * 2.6), [ramp.position[0] + (ramp.yaw > 1 ? 12 : -12), 5.7, (ramp.yaw > 1 ? side : -side) * 2.58]];
    const box = cap.aabb;
    for (const at of points) expect(Math.hypot(Math.max(box.min[0] - at[0], 0, at[0] - box.max[0]), Math.max(box.min[2] - at[2], 0, at[2] - box.max[2]))).toBeLessThanOrEqual(.02);
  }
  // Nominal 2.6 m panels were 2.56 m wide, leaving repeated 4 cm seams.
  const closed = closeBarrierJoints(layout.placements);
  for (const p of closed.filter(p => p.id.startsWith('l3-outskirts-fence-'))) expect(2.56 * p.scale[2]).toBeGreaterThanOrEqual((212 - 132.6) / Math.ceil((212 - 132.6) / 2.6) - .02);
});

test('a wide door uses its normal to bring in a companion when the courier stands off centre', async () => {
  const w = new SimWorld(); await w.init(); w.loadScenario('horde-arena', 1);
  try {
    const p = w.entities.get(1)!;
    Object.assign(p.transform, { x: 12, z: 1 }); w.spatial.set(1, 12, 1);
    const dog = w.entities.get(w.npcs!.companion.spawn())!;
    Object.assign(dog.transform, { x: 12, z: -1 }); w.spatial.set(dog.id, 12, -1);
    const id = w.interactables!.spawn('door', { x: 10, z: 0 }, { halfX: 3, halfZ: .15, radius: 4 });
    const press = { ...emptyInput(), interact: true };
    w.interactables!.update(press);
    expect(w.entities.get(id)!.interactable!.open).toBe(true);
    w.interactables!.update(emptyInput()); w.interactables!.update(press);
    expect(w.entities.get(id)!.interactable!.open).toBe(false);
    expect(dog.transform.z).toBeGreaterThanOrEqual(.7);
  } finally { w.dispose(); }
});

for (const level of ['L3', 'L5'] as const) test(`${level} companion occupies its visible footprint and stays outside courier and reported solids`, async () => {
  const w = await loadLevel(level, 1);
  try {
    const dog = [...w.entities.iterate()].find(e => e.companion)!, p = w.entities.get(1)!;
    for (const [x, z] of level === 'L3' ? [[-134.95, .61], [-90.14, 14.76]] : [[17.78, 30.23]]) {
      Object.assign(p.transform, { x, z, y: .7 + w.districts!.groundHeight(x, z) });
      w.solids.admit(p, 'test.courier', 4, false);
      Object.assign(dog.transform, { ...p.transform, y: p.transform.y - .4 }); w.spatial.set(dog.id, dog.transform.x, dog.transform.z);
      expect(w.solids.admit(dog, 'companion.spawn', 6, false)).toBe(true);
      expect(w.solids.clear(dog.transform, actorRadius(dog), dog.id)).toBe(true);
      const dx = p.transform.x - dog.transform.x, dz = p.transform.z - dog.transform.z, nx = Math.cos(dog.transform.yaw), nz = -Math.sin(dog.transform.yaw);
      const along = Math.max(-.4, Math.min(.4, dx * nx + dz * nz));
      expect(Math.hypot(dx - nx * along, dz - nz * along)).toBeGreaterThanOrEqual(.44 + actorRadius(p) - .02);
      expect(dog.transform.y).toBeCloseTo(w.districts!.groundHeight(dog.transform.x, dog.transform.z) + .3);
    }
  } finally { w.dispose(); }
}, 120_000);

for (const tier of ['high', 'low'] as const) test(`L7 ${tier} start has separate visible survivor bodies at tick 66`, async () => {
  const w = await loadLevel('L7', 1);
  try {
    w.npcs!.setQuality(tier);
    const leader = w.entities.get(1)!.transform;
    for (const e of w.entities.iterate()) if (e.civilian?.survivor && !e.hidden) expect((e.transform.x - leader.x) * Math.cos(leader.yaw) - (e.transform.z - leader.z) * Math.sin(leader.yaw), 'arrive behind the courier in the follow formation').toBeLessThan(-.8);
    for (let i = 0; i < 66; i++) w.update();
    const people = [...w.entities.iterate()].filter(e => e.civilian?.survivor && !e.hidden);
    expect(people.length).toBeGreaterThanOrEqual(15);
    for (let i = 0; i < people.length; i++) for (const other of people.slice(i + 1)) {
      const e = people[i];
      expect(Math.hypot(e.transform.x - other.transform.x, e.transform.z - other.transform.z), `${e.id}/${other.id}`).toBeGreaterThanOrEqual(actorRadius(e) + actorRadius(other) - .02);
    }
  } finally { w.dispose(); }
}, 120_000);

test('L1 never creates a closed shutter around the courier or lifts her capsule onto its leaf', async () => {
  const w = await loadLevel('L1', 1);
  try {
    const m = w.missions!, door = m.def.anchors['fire-bay-door'], p = w.entities.get(1)!;
    Object.assign(p.transform, { x: door.x - .1, z: door.z, y: 1.25 }); w.spatial.set(1, p.transform.x, p.transform.z);
    w.physics.playerBody!.setTranslation(p.transform, true);
    m.setGate('fire-shutter', false);
    expect(m.state.gates['fire-shutter']).toBe(false);
    expect(Math.abs(p.transform.x - door.x)).toBeGreaterThanOrEqual(.55);
    expect(p.transform.y).toBeCloseTo(.7 + w.districts!.groundHeight(p.transform.x, p.transform.z));
    expect(w.solids.clear(p.transform, actorRadius(p), 1, false)).toBe(true);
  } finally { w.dispose(); }
}, 120_000);

test('companion head and rear clear solids even when the central circle is outside', async () => {
  const w = new SimWorld(); await w.init(); w.loadScenario('horde-arena', 1);
  try {
    const dog = w.entities.get(w.npcs!.companion.spawn())!;
    const wall = { x: 2, z: 0, y: .7, halfX: .1, halfZ: 3, halfY: .7 };
    w.events.emit({ type: 'world.blocker.changed', tick: w.tick, id: 910001, blocked: true, wall });
    Object.assign(dog.transform, { x: 1.2, z: 0, y: .3, yaw: 0 });
    expect(w.solids.clear(dog.transform, actorRadius(dog), dog.id, false)).toBe(false);
    dog.transform.yaw = Math.PI / 2;
    expect(w.solids.clear(dog.transform, actorRadius(dog), dog.id, false)).toBe(true);
  } finally { w.dispose(); }
});

test('committed contact cells retain the corgi head clearance from the courier', async () => {
  const w = new SimWorld(); await w.init(); w.loadScenario('horde-arena', 1);
  try {
    const p = w.entities.get(1)!, dog = w.entities.get(w.npcs!.companion.spawn())!;
    Object.assign(p.transform, { x: .4, z: 0, y: .7 }); w.physics.playerBody!.setTranslation(p.transform, true); w.spatial.set(1, .4, 0);
    Object.assign(dog.transform, { x: 2, z: 0, y: .3, yaw: 0 });
    w.spatial.set(dog.id, 2, 0); w.solids.commit();
    p.transform.x = .9; w.spatial.set(1, .9, 0);
    expect(w.solids.clear(p.transform, actorRadius(p), p.id)).toBe(false);
    expect(w.solids.clear(dog.transform, actorRadius(dog), dog.id)).toBe(false);
    w.solids.commit();
    expect(Math.hypot(dog.transform.x - p.transform.x, dog.transform.z - p.transform.z)).toBeGreaterThanOrEqual(1.17);
    expect(p.transform.x, 'head contact projects along the capsule rather than pinning the courier at its previous pose').toBeGreaterThan(.6);
  } finally { w.dispose(); }
});


test('companion head contact projects onto the solid face while retaining forward progress', async () => {
  const w = new SimWorld(); await w.init(); w.loadScenario('horde-arena', 1);
  try {
    const p = w.entities.get(1)!, dog = w.entities.get(w.npcs!.companion.spawn())!;
    Object.assign(p.transform, { x: -5, z: 0, y: .7 }); w.physics.playerBody!.setTranslation(p.transform, true); w.spatial.set(1, -5, 0);
    w.events.emit({ type: 'world.blocker.changed', tick: w.tick, id: 910002, blocked: true, wall: { x: 2, z: 0, y: .7, halfX: .1, halfZ: 3, halfY: .7 } });
    Object.assign(dog.transform, { x: .8, z: 0, y: .3, yaw: 0 }); w.spatial.set(dog.id, .8, 0); w.solids.commit();
    dog.transform.x = 1.3; w.spatial.set(dog.id, 1.3, 0); w.solids.commit();
    expect(dog.transform.x).toBeGreaterThan(1);
    expect(dog.transform.x).toBeLessThanOrEqual(1.08);
    expect(w.solids.clear(dog.transform, actorRadius(dog), dog.id, false)).toBe(true);
  } finally { w.dispose(); }
});

test('the corgi clears its supporting floor while a raised barrier still blocks its body', async () => {
  const w = new SimWorld(); await w.init(); w.loadScenario('horde-arena', 1);
  try {
    const dog = w.entities.get(w.npcs!.companion.spawn())!;
    Object.assign(dog.transform, { x: 0, z: 0, y: .8, yaw: 0 });
    w.events.emit({ type: 'world.blocker.changed', tick: w.tick, id: 910011, blocked: true, wall: { x: 0, z: 0, y: .4, halfX: 3, halfZ: 3, halfY: .1 } });
    expect(w.solids.clear(dog.transform, actorRadius(dog), dog.id, false), 'feet above the floor at y=0.5').toBe(true);
    w.events.emit({ type: 'world.blocker.changed', tick: w.tick, id: 910012, blocked: true, wall: { x: 0, z: 0, y: 1, halfX: .1, halfZ: 3, halfY: .5 } });
    expect(w.solids.clear(dog.transform, actorRadius(dog), dog.id, false), 'the vertical fence intersects the body').toBe(false);
  } finally { w.dispose(); }
});

test('the Metro lookout leaves an interior right-lane slot for the complete corgi capsule', async () => {
  const w = await loadLevel('L5', 1);
  try {
    const m = w.missions!, door = m.def.anchors['l5-metro-shutter'], lookout = w.entities.get(m.state.l5!.lookoutId)!;
    const at = { x: door.x + .5, z: door.z - 2.25 };
    const dx = lookout.transform.x - at.x, dz = lookout.transform.z - at.z;
    const along = Math.max(-.4, Math.min(.4, -dz));
    expect(Math.hypot(dx, dz + along), 'lookout must not occupy the standing dog’s head/rear').toBeGreaterThanOrEqual(.44 + actorRadius(lookout));
  } finally { w.dispose(); }
}, 120_000);


test('companion routes reserve the full body around posts and fall back to body width at narrow doors', async () => {
  const w = new SimWorld(); await w.init(); w.loadScenario('horde-arena', 1);
  try {
    const dog = w.entities.get(w.npcs!.companion.spawn())!, nav = w.infected!.nav;
    Object.assign(dog.transform, { x: 0, z: 0, y: .3, yaw: Math.PI / 2 });
    const steering = vi.spyOn(nav, 'steer');
    w.npcs!.move(dog, { x: 6, z: 0 }, 4.5, dog.companion!, 2);
    expect(steering.mock.calls[0][3], 'a turn reserves the circumscribed capsule').toBeCloseTo(.84);
    steering.mockClear(); steering.mockImplementationOnce(() => false);
    w.npcs!.move(dog, { x: 6, z: 0 }, 4.5, dog.companion!, 2);
    expect(steering.mock.calls).toHaveLength(2);
    expect(steering.mock.calls[0][3]).toBeCloseTo(.84);
    expect(steering.mock.calls[1][3]).toBeCloseTo(.44);
  } finally { vi.restoreAllMocks(); w.dispose(); }
});


test('a companion ahead of a departing courier walks on instead of sealing the route', async () => {
  const w = new SimWorld(); await w.init(); w.loadScenario('horde-arena', 1);
  try {
    const player = w.entities.get(1)!, dog = w.entities.get(w.npcs!.companion.spawn())!;
    Object.assign(player.transform, { x: 0, z: 0, y: .7 }); w.physics.playerBody!.setTranslation(player.transform, true);
    Object.assign(player.survivor!.velocity, { x: 3, z: 0 });
    Object.assign(dog.transform, { x: 1.2, z: 0, y: .3, yaw: 0 });
    w.npcs!.companion.forceSafe = true;
    for (let i = 0; i < 30; i++) { w.tick++; w.npcs!.companion.update(); w.solids.commit(); }
    expect(dog.transform.x, 'the ordinary two-metre follow stop must not pin the player behind its body').toBeGreaterThan(1.5);
    expect(w.solids.clear(dog.transform, .44, dog.id)).toBe(true);
  } finally { w.dispose(); }
});


test('companion keeps an open approach next to a bench instead of substituting a wider goal', async () => {
  const w = new SimWorld(); await w.init(); w.loadScenario('horde-arena', 1);
  try {
    const player = w.entities.get(1)!, dog = w.entities.get(w.npcs!.companion.spawn())!, nav = w.infected!.nav;
    Object.assign(player.transform, { x: -4, z: 0, y: .7 }); w.physics.playerBody!.setTranslation(player.transform, true);
    Object.assign(dog.transform, { x: 0, z: 0, y: .3, yaw: 0 });
    w.events.emit({ type: 'world.blocker.changed', tick: w.tick, id: 910022, blocked: true, wall: { x: 6, z: 1, y: .7, halfX: 1, halfZ: .3, halfY: .7 } });
    expect(nav.clear(6, 0, .44, true)).toBe(true);
    expect(nav.clear(6, 0, .84, true)).toBe(false);
    const steering = vi.spyOn(nav, 'steer');
    expect(w.npcs!.move(dog, { x: 6, z: 0 }, 4.5, dog.companion!, 2)).toBe(true);
    expect(steering.mock.calls).toHaveLength(1);
    expect(steering.mock.calls[0][3]).toBeCloseTo(.44);
    expect(dog.companion!.path).toHaveLength(0);
  } finally { vi.restoreAllMocks(); w.dispose(); }
});
