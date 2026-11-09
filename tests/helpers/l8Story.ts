import { expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { Box3, BoxGeometry, Group, Mesh, MeshBasicNodeMaterial, Vector3 } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { emptyInput } from '../../src/input/InputFrame';
import { LevelEightBot } from '../../src/debug/bot/LevelEightBot';
import { zooExitGate, poseZooExitGate } from '../../src/render/district/zooExitGate';
import { k9VestModel } from '../../src/render/characters/K9Vest';
import { survivorName } from '../../src/sim/missions/survivorName';
import { loadLevel } from '../qa/invariants/world';

function gateGeometry(): void {
  const root = new Group(), source = new BoxGeometry(.12, 2.6, 2.7);
  const lintelGeometry = new BoxGeometry(.35, .3, 6.6);
  const left = new Mesh(source), right = new Mesh(source), lintel = new Mesh(lintelGeometry);
  left.position.set(116, 1.6, 78.65); right.position.set(116, 1.6, 81.35); lintel.position.set(116, 4.15, 80);
  root.add(left, right, lintel);
  const split = zooExitGate(root);
  expect(split.leaves.map(leaf => leaf.children.length)).toEqual([1, 1]);
  expect(left.geometry.index!.count).toBe(0); expect(right.geometry.index!.count).toBe(0);
  expect(lintel.geometry.index!.count).toBe(36); expect(source.index!.count).toBe(36);
  poseZooExitGate(split.leaves, 1);
  expect(new Box3().setFromObject(split.leaves[0]).max.z).toBeLessThan(78);
  expect(new Box3().setFromObject(split.leaves[1]).min.z).toBeGreaterThan(82);
  split.geometry.forEach(geometry => geometry.dispose()); source.dispose(); lintelGeometry.dispose();
  const dog = new Group(), body = new Group(), clothGeometry = new BoxGeometry(.6, .3, .5);
  body.name = 'body'; body.position.y = .6; dog.add(body);
  const clothMaterial = new MeshBasicNodeMaterial(); clothMaterial.name = 'pal_navy';
  const cloth = new Mesh(clothGeometry, clothMaterial); body.add(cloth);
  const vest = k9VestModel(dog, .47);
  expect(new Box3().setFromObject(vest).getSize(new Vector3()).z).toBeCloseTo(.47);
  expect(cloth.geometry).toBe(clothGeometry);
  vest.traverse(node => { if (node instanceof Mesh) { node.geometry.dispose(); for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose(); } });
  clothGeometry.dispose(); clothMaterial.dispose();
}

/** Real input for the tour/breach, then isolated boarding to exercise the story controller without another full combat run. */
export async function checkL8Story(): Promise<void> {
  gateGeometry();
  const bytes = await readFile('public/assets/models/inf.dog-k9.lod1.glb');
  const dogModel = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(new Uint8Array(bytes).buffer, '');
  const vest = k9VestModel(dogModel.scene, .47), vestSize = new Box3().setFromObject(vest).getSize(new Vector3());
  expect(vest.children.length, 'the shipped police vest has drawable palette primitives').toBeGreaterThan(0);
  expect(vestSize.z).toBeCloseTo(.47); expect(vestSize.x).toBeGreaterThan(.4); expect(vestSize.y).toBeGreaterThan(.15);
  for (const model of [vest, dogModel.scene]) model.traverse(node => { if (node instanceof Mesh) { node.geometry.dispose(); for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose(); } });
  const world = await loadLevel('L8', 1808), mission = world.missions!, zoo = mission.l8!, lines: string[] = [];
  const watchedAnimalId = zoo.state.animals[5], bites: { tick: number }[] = [], turns: { tick: number; infectedId: number }[] = [];
  const habitats: Record<string, { minX: number; maxX: number; minZ: number; maxZ: number }> = {
    lion: { minX: -82, maxX: -38, minZ: -52, maxZ: -12 }, gorilla: { minX: 38, maxX: 82, minZ: -52, maxZ: -12 },
    lioness: { minX: -82, maxX: -38, minZ: -52, maxZ: -12 }, elephant: { minX: -82, maxX: -38, minZ: 12, maxZ: 52 }, zebra: { minX: 38, maxX: 82, minZ: 12, maxZ: 52 },
    flamingo: { minX: -14, maxX: 14, minZ: -52, maxZ: -12 }, monkey: { minX: -20, maxX: -10.48, minZ: 20, maxZ: 31.9 },
  };
  let biteDistance = Infinity;
  const off = world.events.on('dialogue.line', event => { if (event.type === 'dialogue.line') lines.push(event.id); });
  const offBite = world.events.on('outbreak.bite', event => {
    if (event.type !== 'outbreak.bite' || event.targetId !== watchedAnimalId) return;
    bites.push({ tick: event.tick });
    const player = world.entities.get(1)!.transform;
    biteDistance = Math.hypot(player.x - event.position.x, player.z - event.position.z);
  });
  const offTurn = world.events.on('civilian.turned', event => {
    if (event.type === 'civilian.turned' && event.id === watchedAnimalId) turns.push({ tick: event.tick, infectedId: event.infectedId });
  });
  try {
    const bot = new LevelEightBot(world), nearest = new Map(zoo.state.animals.map(id => [id, Infinity]));
    const cast = [zoo.state.keeperId, zoo.state.haleId, zoo.state.reyesId];
    let calmHealthy = true;
    for (let i = 0; i < 3600; i++) {
      world.applyInput(bot.sample(), 'keyboard'); world.update();
      const player = world.entities.get(1)!.transform;
      for (const id of zoo.state.animals) {
        const animal = world.entities.get(id)!;
        nearest.set(id, Math.min(nearest.get(id)!, Math.hypot(player.x - animal.transform.x, player.z - animal.transform.z)));
        if (i < 3599) {
          if (animal.infected || animal.infection || animal.health.current <= 0) calmHealthy = false;
          const species = animal.civilian?.zooAnimal, bounds = species && habitats[species];
          if (!bounds || animal.transform.x < bounds.minX - .1 || animal.transform.x > bounds.maxX + .1 || animal.transform.z < bounds.minZ - .1 || animal.transform.z > bounds.maxZ + .1)
            throw new Error(`Healthy zoo animal ${id} left its ${species ?? 'unknown'} enclosure at ${animal.transform.x.toFixed(2)}, ${animal.transform.z.toFixed(2)} on calm tick ${i}`);
        }
      }
    }
    expect(calmHealthy, 'no animal turns or dies before the alarm').toBe(true);
    for (const [id, distance] of nearest) {
      if (world.entities.get(id)?.civilian?.zooAnimal === 'monkey') continue;
      expect(distance, `tour animal ${id} near the real courier route`).toBeLessThan(18);
    }
    expect(lines).toEqual(expect.arrayContaining(['L8.nadia-path', 'L8.nadia-lion', 'L8.broadcast', 'L8.hale-greeting', 'L8.hale-breach']));
    expect(mission.state.states.breached).toBe(true);
    expect(world.entities.get(zoo.state.dogId)!.infected!.variant).toBe('inf.dog-k9');
    expect(zoo.state.outlets.some(outlet => outlet.ids.includes(zoo.state.dogId)), 'K9 emerges through a real tunnel').toBe(true);

    zoo.state.nextWave = Number.MAX_SAFE_INTEGER; world.combat!.damage.god = true;
    world.applyInput(emptyInput(), 'keyboard');
    for (let i = 0; i < 1800 && (!world.entities.get(watchedAnimalId)?.infected || !zoo.state.keeperAttacked); i++) world.update();
    const bird = world.entities.get(watchedAnimalId), runner = world.entities.get(zoo.state.animalInterceptionId);
    expect(bird?.archetype, `flamingo turns in the first 30 s; bird=${JSON.stringify({ at: bird?.transform, state: bird?.civilian?.state, infection: bird?.infection })}; runner=${JSON.stringify({ at: runner?.transform, emerging: runner?.emerging })}`).toBe('infected.flamingo');
    expect(biteDistance, 'the first bite is visible beside the courier route').toBeLessThan(20);
    expect(zoo.state.keeperAttacked, 'the pond keeper is pulled down, independently of Nadia').toBe(true);
    const turn = turns[0];
    if (!turn) throw new Error('Opening flamingo has no same-ID turn event');
    expect(turn.infectedId).toBe(watchedAnimalId); expect(bites.length).toBeGreaterThan(0);
    expect(turn.tick - bites[0].tick).toBeGreaterThanOrEqual(150);
    expect(turn.tick - bites[0].tick).toBeLessThanOrEqual(210);

    const sam = zoo.state.roster.map(id => world.entities.get(id)).find(e => e?.civilian?.survivor?.key === 'sam');
    if (sam) sam.health.current = 0;
    zoo.update();
    expect(world.entities.get(zoo.state.reyesId)!.civilian!.survivor!.key).toBe('reyes');
    expect(zoo.passengers()).toContain(zoo.state.reyesId);
    expect(survivorName(world.entities.get(zoo.state.reyesId)!)).toBe('Private Reyes');

    mission.state.steps.sanctuary.status = 'completed'; mission.state.steps.escape.status = 'active';
    world.tick = Math.max(world.tick, zoo.state.breachedAt + 1800);
    const player = world.entities.get(1)!, carId = zoo.state.carId, car = world.entities.get(carId)!, ids = zoo.passengers();
    Object.assign(player.transform, zoo.door()); player.health.current = player.health.max;
    // The following isolated controller fixture skips the actual retreat;
    // story-probe.ts separately checks Hale reaches this post in ordinary play.
    const hale = world.entities.get(zoo.state.haleId)!, halePost = { x: zoo.door().x - .7, z: zoo.door().z + 1.2 };
    Object.assign(hale.transform, halePost); hale.civilian!.ally!.run = null; hale.civilian!.ally!.post = halePost;
    mission.state.phase = 'playing'; car.health.current = car.health.max; car.vehicle!.damage = 'normal'; car.vehicle!.driver = null;
    car.vehicle!.passengers = ids.map((id, seat) => ({ id, seat, phase: 'seated' as const, started: world.tick, pauseUntil: 0, from: { ...world.entities.get(id)!.transform } }));
    world.vehicles!.active = null;
    expect(zoo.canBoardDriver()).toBe(false);
    zoo.update();
    expect(zoo.state.megaId).toBeGreaterThan(0);
    expect(world.entities.get(zoo.state.megaId)!.transform.z).toBeLessThan(-86);
    expect(world.entities.get(zoo.state.megaId)!.transform.y).toBeGreaterThan(4);
    expect(zoo.cameraPose()!.target[2], 'the live reveal camera follows the wall crossing').toBeLessThan(-86);
    expect(zoo.canBoardDriver(), 'the courier covers the scene on foot').toBe(false);
    world.tick = zoo.state.sightingAt + 14 * 60; mission.state.phase = 'playing'; mission.state.cinematic = null; zoo.update();
    expect(mission.state.states['hale-keys']).toBe(true);
    expect(world.entities.get(zoo.state.haleId)!.civilian!.story!.clip).toBe('npc-give');
    world.tick = zoo.state.sightingAt + 15 * 60; zoo.update();
    expect(mission.state.states['hale-fallen']).toBe(true);
    expect(world.entities.get(zoo.state.haleId)!.health.current).toBe(0);
    expect(lines).toContain('L8.hale-dying');
    world.tick = zoo.state.departureAt; zoo.update();
    expect(zoo.canBoardDriver()).toBe(true); expect(lines).not.toContain('L8.following');
    car.vehicle!.driver = 1; world.vehicles!.active = carId;
    zoo.update();
    expect(lines).toContain('L8.following'); expect(zoo.cameraPose()).not.toBeNull();
    const megaFrom = { ...world.entities.get(zoo.state.megaId)!.transform };
    const wheelFrom = world.vehicles!.cars.get(carId)!.physics.wheels[0].rotation;
    // Exercise the story and AgentMotion together: scripted displacement must
    // enter the distance-driven gait once, not once in each publisher.
    mission.state.phase = 'playing'; mission.state.cinematic = null;
    world.applyInput(emptyInput(), 'keyboard'); world.update();
    const movingMega = world.entities.get(zoo.state.megaId)!, beforeMotion = movingMega.motion!.distance, beforePosition = { ...movingMega.transform };
    world.update();
    const travelled = Math.hypot(movingMega.transform.x - beforePosition.x, movingMega.transform.z - beforePosition.z);
    expect(travelled, 'the scripted Mega actually moves during the measured tick').toBeGreaterThan(.05);
    expect(movingMega.motion!.distance - beforeMotion, 'Mega gait distance equals resolved story displacement').toBeCloseTo(travelled, 6);
    for (let i = 2; i < 480; i++) { world.tick++; zoo.update(); }
    expect(car.transform.x, 'the APC physically exits through the east gate').toBeGreaterThan(116);
    expect(car.transform.z).toBe(80); expect(mission.state.states.departed).toBe(true);
    expect(world.vehicles!.cars.get(carId)!.physics.wheels[0].rotation).toBeGreaterThan(wheelFrom + 1);
    expect(world.events.events().some(event => event.type === 'vehicle.sound' && event.sourceId === carId && event.phase === 'engine' && event.speed > 0)).toBe(true);
    const mega = world.entities.get(zoo.state.megaId)!;
    expect(mega.hidden).not.toBe(true); expect(mega.transform.x).toBeGreaterThan(megaFrom.x);
    expect(car.transform.x - mega.transform.x, 'the Mega stays visible behind the APC').toBeLessThan(15);
    expect(car.vehicle!.passengers!.map(seat => seat.id)).toEqual(ids);

    world.storyLock = { scripted: null, skip: false };
    mission.restore('sanctuary');
    expect(world.storyLock).toBeNull();
    expect([zoo.state.keeperId, zoo.state.haleId, zoo.state.reyesId]).toEqual(cast);
    for (const id of cast) expect(world.entities.get(id)!.health.current).toBeGreaterThan(0);
    expect(zoo.state.megaId).toBe(0); expect(zoo.state.greetingAt - world.tick).toBe(180);
  } finally { off(); offBite(); offTurn(); world.dispose(); }
}
