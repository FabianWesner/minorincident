import { expect } from 'vitest';
import { emptyInput } from '../../src/input/InputFrame';
import { curePursuitRoute } from '../../src/levels/L10/district';
import { boxContact } from '../../src/sim/world/SolidGeometry';
import { megaAlpha } from '../../src/data/megaAlpha';
import { loadLevel } from '../../tools/sim-runner/levels';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { installMegaPursuit } from '../../src/sim/ai/MegaPursuit';
import { runLevel } from '../../tools/sim-runner/levels';

async function detour(wall: boolean): Promise<{ ticks: number; path: number; side: number }> {
  const world = new SimWorld();
  try {
    await world.init(); world.loadScenario('horde-arena'); world.combat!.damage.god = true;
    const player = world.entities.get(1)!;
    Object.assign(player.transform, { x: 10, z: 0 });
    world.physics.playerBody!.setTranslation({ x: 10, y: player.transform.y, z: 0 }, true);
    if (wall) {
      const box = { x: 0, z: 0, y: 1, halfX: 1, halfZ: 4, halfY: 1 };
      world.solids.setBarrier('mega-test-house', box);
      world.events.emit({ type: 'world.blocker.changed', tick: world.tick, id: 987656, blocked: true, wall: box });
    }
    const pursuit = installMegaPursuit(world, { introduceTick: null, spawn: { x: -10, z: 0 }, resident: () => true,
      route: { nodes: [{ id: 'a', x: -10, z: 0 }, { id: 'b', x: 10, z: 0 }], links: [['a', 'b']], pressure: { from: 'a', trailM: 1 } } });
    const mega = world.entities.get(pursuit.introduce())!;
    let ticks = 0, path = 0, side = 0, previous = { x: mega.transform.x, z: mega.transform.z };
    while (ticks < 1800 && Math.hypot(mega.transform.x - 10, mega.transform.z) > 4) {
      world.update(); ticks++;
      path += Math.hypot(mega.transform.x - previous.x, mega.transform.z - previous.z);
      previous = { x: mega.transform.x, z: mega.transform.z }; side = Math.max(side, Math.abs(mega.transform.z));
      expect(world.solids.clear(mega.transform, mega.combat!.radius, mega.id, false, 1e-8), `detour tick ${ticks}`).toBe(true);
    }
    expect(ticks, 'Mega reaches the far side').toBeLessThan(1800);
    return { ticks, path, side };
  } finally { world.dispose(); }
}

export async function checkBlockedLinks(): Promise<void> {
  const world = new SimWorld();
  try {
    await world.init(); world.loadScenario('horde-arena');
    const pursuit = installMegaPursuit(world, { introduceTick: null, spawn: { x: -10, z: 0 }, resident: () => true,
      route: { nodes: [{ id: 'a', x: -10, z: 0 }, { id: 'b', x: 10, z: 0 }], links: [['a', 'b']], pressure: { from: 'a', trailM: 1 } } });
    const mega = world.entities.get(pursuit.introduce())!;
    Object.assign(pursuit.state, { passed: 'a', route: ['b'], target: { x: 10, z: 0 }, blocked: { 'a|b': world.tick + 120 } });
    pursuit.drive(mega);
    expect(pursuit.state.breach, 'temporary avoidance cannot be breached').toBeNull();
    expect(pursuit.state.blocked['a|b']).toBe(world.tick + 120);
    pursuit.blockLink('a', 'b');
    pursuit.drive(mega);
    expect(pursuit.state.breach?.link, 'authored closure can be breached').toBe('a|b');
  } finally { world.dispose(); }
}

export async function checkDeferredIntroduction(): Promise<void> {
  const world = new SimWorld();
  try {
    await world.init(); world.loadScenario('horde-arena');
    const pursuit = installMegaPursuit(world, { introduceTick: null, spawn: { x: 0, z: 0 }, resident: () => true });
    const wall = { x: 0, z: 0, y: 1, halfX: 10, halfZ: 10, halfY: 1 };
    world.solids.setBarrier('spawn-test', wall);
    world.events.emit({ type: 'world.blocker.changed', tick: world.tick, id: 123456, blocked: true, wall });
    const reserved = world.infected!.director.reserved;
    expect(pursuit.introduce()).toBe(0);
    expect(pursuit.entity()).toBeNull();
    expect(world.infected!.director.reserved).toBe(reserved);
    world.solids.setBarrier('spawn-test', null);
    world.events.emit({ type: 'world.blocker.changed', tick: world.tick, id: 123456, blocked: false, wall });
    for (let i = 0; i < 61; i++) world.update();
    expect(pursuit.entity(), 'introduction retries when ground clears').not.toBeNull();
  } finally { world.dispose(); }
}

export async function checkUnloadedDetour(): Promise<void> {
  const spawnWorld = await loadLevel('L10', 1);
  try {
    const pursuit = spawnWorld.megaPursuit!, entity = spawnWorld.entities.get(pursuit.introduce({ x: 833, z: 88.8199 }))!;
    expect(Math.hypot(entity.transform.x - 833, entity.transform.z - 88.8199), 'invalid unloaded spawn is moved to clear ground').toBeGreaterThan(0);
    expect(spawnWorld.infected!.director.inFrame(entity.transform, 1, true), 'spawn correction stays offscreen').toBe(false);
  } finally { spawnWorld.dispose(); }
  const world = await loadLevel('L10', 1);
  try {
    const pursuit = world.megaPursuit!, mega = world.entities.get(pursuit.introduce({ x: 823, z: 88.8199 }))!;
    Object.assign(pursuit.state, { target: { x: 850, z: 100 }, route: [], passed: null, routeAt: Infinity });
    expect(world.chunks!.resident(mega.transform.x, mega.transform.z)).toBe(false);
    let path = 0, prev = { x: mega.transform.x, z: mega.transform.z };
    for (let tick = 0; tick < 600 && mega.transform.x < 845; tick++) {
      world.update();
      const p = mega.transform; path += Math.hypot(p.x - prev.x, p.z - prev.z); prev = { x: p.x, z: p.z };
      for (const district of world.districts!.districts) for (const collider of district.decay.colliders) {
        if (!collider.id.startsWith('bld.') || collider.walkable) continue;
        const b = collider.aabb;
        if (b.max[1] <= p.y - .6 || b.min[1] >= p.y + .65) continue;
        const box = { x: (b.min[0] + b.max[0]) / 2 + district.origin[0], z: (b.min[2] + b.max[2]) / 2 + district.origin[1], y: 1,
          halfX: (b.max[0] - b.min[0]) / 2, halfZ: (b.max[2] - b.min[2]) / 2, halfY: 1 };
        if (Math.abs(p.x - box.x) > box.halfX + megaAlpha.radius || Math.abs(p.z - box.z) > box.halfZ + megaAlpha.radius) continue;
        const c = boxContact(box, p.x, p.z, megaAlpha.radius, { depth: 0, nx: 0, nz: 0, inside: false });
        expect(c.depth, `${collider.id} at tick ${world.tick}`).toBeLessThanOrEqual(1e-8);
      }
    }
    expect(mega.transform.x, 'nonresident Mega reaches the far side').toBeGreaterThanOrEqual(845);
    expect(path, 'detour costs distance').toBeGreaterThan(26);
  } finally { world.dispose(); }
}

async function checkRouteSolids(): Promise<void> {
  const world = await loadLevel('L10', 1);
  try {
    const nodes = new Map(curePursuitRoute.nodes.map(node => [node.id, node]));
    const hits: string[] = [];
    for (const [a, b] of curePursuitRoute.links) {
      const from = nodes.get(a)!, to = nodes.get(b)!;
      const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) * 2));
      for (const district of world.districts!.districts) for (const collider of district.decay.colliders) {
        const bounds = collider.aabb;
        if (collider.walkable || bounds.max[1] <= .1 || bounds.min[1] >= 1.35) continue;
        const box = { x: (bounds.min[0] + bounds.max[0]) / 2 + district.origin[0], z: (bounds.min[2] + bounds.max[2]) / 2 + district.origin[1], y: 1,
          halfX: (bounds.max[0] - bounds.min[0]) / 2, halfZ: (bounds.max[2] - bounds.min[2]) / 2, halfY: 1 };
        for (let i = 0; i <= steps; i++) {
          const t = i / steps, contact = boxContact(box, from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t, megaAlpha.radius, { depth: 0, nx: 0, nz: 0, inside: false });
          if (contact.depth > 1e-8) { hits.push(`${a} -> ${b}: ${collider.id}`); break; }
        }
      }
    }
    expect(hits.join('\n'), 'authored pursuit links clear static colliders').toBe('');
  } finally { world.dispose(); }
}

export async function megaBuildingOverlap(): Promise<void> {
  await checkRouteSolids();
  await checkBlockedLinks();
  await checkDeferredIntroduction();
  await checkUnloadedDetour();
  const clear = await detour(false), blocked = await detour(true);
  expect(blocked.ticks, 'wall costs real time').toBeGreaterThan(clear.ticks + 60);
  expect(blocked.path, 'wall requires a longer path').toBeGreaterThan(clear.path + 2);
  expect(blocked.side, 'Mega goes around the wall').toBeGreaterThan(5);
  for (const level of ['L9', 'L10'] as const) for (const passive of [false, true]) {
    const intersections: string[] = [];
    let samples = 0, stationaryTicks = 0, maxStep = 0;
    let previous: { id: number; tick: number; x: number; z: number } | undefined;
    const report = await runLevel(level, 'complete', 1, level === 'L10' ? 3600 : 900, 'auto', undefined, undefined, 0, {
      passive,
      beforeBegin: world => {
        // District collider data remains available even when streaming unloads
        // the corresponding navigation cells. Bucket buildings independently
        // so the audit does not inherit the resident query's blind spot.
        const buildings = new Map<string, { id: string; box: { x: number; z: number; y: number; halfX: number; halfZ: number; halfY: number } }[]>();
        for (const district of world.districts!.districts) for (const collider of district.decay.colliders) {
          if (!collider.id.startsWith('bld.') || collider.walkable) continue;
          const b = collider.aabb;
          const box = { x: (b.min[0] + b.max[0]) / 2 + district.origin[0], z: (b.min[2] + b.max[2]) / 2 + district.origin[1], y: (b.min[1] + b.max[1]) / 2,
            halfX: (b.max[0] - b.min[0]) / 2, halfZ: (b.max[2] - b.min[2]) / 2, halfY: (b.max[1] - b.min[1]) / 2 };
          for (let x = Math.floor((box.x - box.halfX - megaAlpha.radius) / 16); x <= Math.floor((box.x + box.halfX + megaAlpha.radius) / 16); x++)
            for (let z = Math.floor((box.z - box.halfZ - megaAlpha.radius) / 16); z <= Math.floor((box.z + box.halfZ + megaAlpha.radius) / 16); z++) {
              const key = `${x},${z}`, bucket = buildings.get(key) ?? []; bucket.push({ id: collider.id, box }); buildings.set(key, bucket);
            }
        }
        if (passive && level === 'L10') {
          const apply = world.applyInput.bind(world);
          world.applyInput = (frame, scheme) => {
            const stationary = !!world.missions?.state.states['charge-active'];
            if (stationary) stationaryTicks++;
            apply(stationary ? emptyInput() : frame, scheme);
          };
        }
        const update = world.update.bind(world);
        world.update = (...args: Parameters<typeof world.update>) => {
          update(...args);
          const id = level === 'L9' ? world.missions?.l9?.driving.state.megaId : world.megaPursuit?.state.id;
          const mega = id ? world.entities.get(id) : undefined;
          if (!mega || (mega.hidden || mega.infected?.hidden) && !world.infected!.director.inFrame(mega.transform)) return;
          samples++;
          if (previous?.id === mega.id && previous.tick === world.tick - 1) {
            maxStep = Math.max(maxStep, Math.hypot(mega.transform.x - previous.x, mega.transform.z - previous.z));
          }
          previous = { id: mega.id, tick: world.tick, x: mega.transform.x, z: mega.transform.z };
          for (const building of buildings.get(`${Math.floor(mega.transform.x / 16)},${Math.floor(mega.transform.z / 16)}`) ?? []) {
            const p = mega.transform, box = building.box;
            if (box.y + box.halfY <= p.y - .6 || box.y - box.halfY >= p.y + .65) continue;
            const contact = boxContact(box, p.x, p.z, mega.combat!.radius, { depth: 0, nx: 0, nz: 0, inside: false });
            if (contact.depth > 1e-8) intersections.push(`tick=${world.tick} x=${p.x.toFixed(2)} z=${p.z.toFixed(2)} mode=${world.megaPursuit?.state.mode ?? 'sighting'} building=${building.id} depth=${contact.depth}`);
          }
          if (!world.solids.clear(mega.transform, mega.combat!.radius, mega.id, false, 1e-8)) {
            intersections.push(`tick=${world.tick} x=${mega.transform.x.toFixed(2)} z=${mega.transform.z.toFixed(2)} mode=${world.megaPursuit?.state.mode ?? 'sighting'} hidden=${!!mega.infected?.hidden} contacts=${JSON.stringify(world.solids.staticContacts(mega.transform, mega.combat!.radius, mega.id))}`);
          }
        };
      },
    });
    expect(report.outcome).not.toBe('load-error');
    if (!passive) expect(report.completed, `${level}: ${report.outcome}`).toBe(true);
    expect(samples).toBeGreaterThan(0);
    expect(maxStep, `${level} Mega maximum visible step`).toBeLessThanOrEqual(1);
    if (passive && level === 'L10') expect(stationaryTicks).toBeGreaterThan(60);
    expect(intersections.join('\n')).toBe('');
  }
}
