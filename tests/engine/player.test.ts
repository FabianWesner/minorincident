// Courier locomotion and health: one kinematic controller and one health/respawn model for every level.
import { afterEach, expect, test } from 'vitest';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { survivor } from '../../src/data/survivor';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { highwayPoint } from '../../src/levels/L3/highway';
import { readFileSync } from 'node:fs';
import { compositions } from '../../src/levels/compositions';

const worlds: SimWorld[] = [];
async function setup(scenario = 'survivor'): Promise<SimWorld> { const w = new SimWorld(); worlds.push(w); await w.init(); w.loadScenario(scenario, 1); return w; }
const step = (w: SimWorld, ticks: number) => { for (let i = 0; i < ticks; i++) w.update(); };
afterEach(() => { for (const w of worlds) w.dispose(); worlds.length = 0; });

test('movement: fast acceleration and stop, capped diagonal speed, 720°/s turning, one-tick aim snap, campaign ramps and stairs', async () => {
  const w = await setup(); w.setInput({ move: { x: 1, z: 0 } }); step(w, 9);
  expect(w.player!.locomotion.displacement.x * 60).toBeGreaterThanOrEqual(4.5 * 0.95);
  w.setInput({ move: { x: 0, z: 0 } }); step(w, 6);
  expect(Math.hypot(w.player!.locomotion.displacement.x, w.player!.locomotion.displacement.z)).toBeLessThan(1e-6);
  w.setInput({ move: { x: 10, z: 10 } }); step(w, 15);
  expect(Math.hypot(w.player!.locomotion.velocity.x, w.player!.locomotion.velocity.z)).toBeCloseTo(4.5);

  const a = await setup(), p = a.entities.get(1)!;
  a.setInput({ aim: { x: 0, z: 1 }, left: { held: true, down: false, up: false } }); step(a, 1);
  expect(p.transform.yaw).toBeCloseTo(-Math.PI / 2);
  a.clearInput(); p.transform.yaw = 0; a.setInput({ move: { x: -1, z: 0 }, aim: { x: 1, z: 0 } }); step(a, 1);
  expect(Math.abs(p.transform.yaw)).toBeCloseTo(4 * Math.PI / 60);
  step(a, 14); expect(Math.abs(p.transform.yaw)).toBeCloseTo(Math.PI);
  await campaignRampTraversal();

  // L7's logical road remains solid throughout Alpha stun, including when
  // the stun blocks held movement. Removing the support still permits a fall.
  const raised = await setup(), courier = raised.entities.get(1)!;
  expect(raised.player!.locomotion.supportWhenDisabled).toBe(false);
  raised.player!.locomotion.supportWhenDisabled = true;
  courier.transform.y = 3.9 + survivor.height / 2 + .005;
  raised.physics.playerBody!.setTranslation(courier.transform, true);
  raised.solids.remember(courier, 'test.raised-stun');
  raised.player!.locomotion.groundHeight = () => 3.9;
  courier.combat = { radius: survivor.radius, armor: 0, shield: false, staggerUntil: raised.tick + 90, attacking: false, damageMultiplier: 1, statuses: [] };
  raised.setInput({ move: { x: 1, z: 0 } });
  for (let tick = 0; tick < 89; tick++) {
    step(raised, 1);
    expect(courier.transform.y).toBeGreaterThanOrEqual(4.6);
    expect(courier.transform.x).toBeCloseTo(0);
  }
  raised.player!.locomotion.groundHeight = () => 0;
  courier.combat.staggerUntil = raised.tick + 90;
  step(raised, 60); expect(courier.transform.y).toBeLessThan(1);
});

/** Production controller traversal for the campaign's authored gameplay elevation routes. */
async function campaignRampTraversal(): Promise<void> {
  for (const quality of ['low', 'high'] as const) {
    const l3 = await slopeWorld('L3', quality);
    const ramps = l3.districts!.districts.flatMap(d => d.decay.placements.filter(p => p.assetId === 'kit.highway-onramp')).sort((a, b) => a.position[0] - b.position[0]);
    expect(ramps.map(r => r.id)).toEqual(['kit.highway-onramp:991', 'kit.highway-onramp:992']);
    for (const ramp of ramps) for (const walk of [false, true]) {
      const foot = highwayPoint(ramp, 1), gait = walk ? 'walking' : 'running';
      const points: [number, number, number][] = [[foot[0] + 4.5 * Math.cos(ramp.yaw), 0, foot[2] - 4.5 * Math.sin(ramp.yaw)], ...Array.from({ length: 51 }, (_, i) => highwayPoint(ramp, 1 - i / 50))], player = l3.entities.get(1)!;
      const [x, surfaceY, z] = points[0]!;
      Object.assign(player.transform, { x, y: surfaceY + .705, z });
      l3.physics.playerBody!.setTranslation(player.transform, true); l3.solids.remember(player, `ramp-traversal:${ramp.id}`); l3.player!.locomotion.reset();
      let waypoint = 1;
      for (let tick = 0; tick < 2200 && waypoint < points.length; tick++) {
        const [tx, , tz] = points[waypoint]!, dx = tx - player.transform.x, dz = tz - player.transform.z, distance = Math.hypot(dx, dz) || 1;
        l3.setInput({ move: { x: dx / distance, z: dz / distance }, walk }); l3.update();
        if (Math.hypot(tx - player.transform.x, tz - player.transform.z) < .35) waypoint++;
      }
      l3.clearInput();
      expect(waypoint, `${quality} ${ramp.id} ${gait} climbs the entry lips and reaches the far end of its authored centreline`).toBe(points.length);
      expect(Math.hypot(player.transform.x - points.at(-1)![0], player.transform.z - points.at(-1)![2])).toBeLessThan(.6);
      expect(player.transform.y, `${quality} ${ramp.id} arrives on the elevated deck`).toBeGreaterThan(points.at(-1)![1] + .6);
    }
    // Recover from the PO's actual edge-of-curve pose, rather than only testing an ideal start at the foot.
    const reported = l3.entities.get(1)!, ramp = ramps[0]!, recovery = Array.from({ length: 21 }, (_, i) => highwayPoint(ramp, .4 * (1 - i / 20)));
    Object.assign(reported.transform, { x: 159.34, y: 5.69, z: -1.32 });
    l3.physics.playerBody!.setTranslation(reported.transform, true); l3.solids.remember(reported, 'ramp-traversal:po-pose'); l3.player!.locomotion.reset();
    let recoveryPoint = 0;
    for (let tick = 0; tick < 600 && recoveryPoint < recovery.length; tick++) {
      const [x, , z] = recovery[recoveryPoint]!, dx = x - reported.transform.x, dz = z - reported.transform.z, distance = Math.hypot(dx, dz) || 1;
      l3.setInput({ move: { x: dx / distance, z: dz / distance } }); l3.update();
      if (Math.hypot(dx, dz) < .4) recoveryPoint++;
    }
    l3.clearInput();
    expect(recoveryPoint, `${quality} reported L3 pose can rejoin the bend and reach the deck`).toBe(recovery.length);
    expect(reported.transform.y).toBeGreaterThan(6.3);
    await rampContacts(quality);

    const metro = await slopeWorld('L5', quality);
    const entrance = metro.districts!.districts.flatMap(d => d.decay.placements).find(p => p.id === 'bld.metro-entrance:225')!, player = metro.entities.get(1)!;
    Object.assign(player.transform, { x: entrance.position[0], y: .855, z: entrance.position[2] - 2.2 });
    metro.physics.playerBody!.setTranslation(player.transform, true); metro.solids.remember(player, `ramp-traversal:${entrance.id}`); metro.player!.locomotion.reset();
    let metroTop = player.transform.y;
    for (let tick = 0; tick < 120; tick++) { metro.setInput({ move: { x: 0, z: 1 } }); metro.update(); metroTop = Math.max(metroTop, player.transform.y); }
    metro.clearInput();
    expect(player.transform.z, `${quality} metro stair reaches its upper landing`).toBeGreaterThan(entrance.position[2] + 1.8);
    expect(metroTop, `${quality} metro stair climbs above its lower street`).toBeGreaterThan(1.7);

    const subway = await slopeWorld('L6', quality);
    const exit = subway.districts!.districts.flatMap(d => d.decay.placements).find(p => p.assetId === 'int.metro-exit')!, survivor = subway.entities.get(1)!;
    for (const [route, offset] of [['stairs', 1.4], ['escalator', -.9]] as const) {
      Object.assign(survivor.transform, { x: exit.position[0] - 3.2, y: exit.position[1] + .905, z: exit.position[2] + offset });
      subway.physics.playerBody!.setTranslation(survivor.transform, true); subway.solids.remember(survivor, `ramp-traversal:${exit.id}:${route}`); subway.player!.locomotion.reset();
      for (let tick = 0; tick < 110; tick++) { subway.setInput({ move: { x: 1, z: 0 } }); subway.update(); }
      subway.clearInput();
      expect(survivor.transform.x, `${quality} subway ${route} reaches its upper landing`).toBeGreaterThan(exit.position[0] + 3.2);
      expect(survivor.transform.y, `${quality} subway ${route} arrives at street height`).toBeGreaterThan(exit.position[1] + 4.1);
    }

    // Northgate's terraced road is an authored slope too. Load the production
    // composition without its opening cinematic, which otherwise owns the courier pose.
    const northgate = await slopeWorld('L7', quality);
    const climber = northgate.entities.get(1)!;
    Object.assign(climber.transform, { x: 90, y: .705, z: 15 });
    northgate.physics.playerBody!.setTranslation(climber.transform, true); northgate.solids.remember(climber, 'ramp-traversal:northgate'); northgate.player!.locomotion.reset();
    for (let tick = 0; tick < 3000 && climber.transform.x < 250; tick++) { northgate.setInput({ move: { x: 1, z: 0 } }); northgate.update(); }
    northgate.clearInput();
    expect(climber.transform.x, `${quality} Northgate road reaches its raised end`).toBeGreaterThanOrEqual(250);
    expect(climber.transform.y, `${quality} Northgate road arrives at street height`).toBeGreaterThan(4.5);

    const cure = await slopeWorld('L10', quality);
    const platform = cure.districts!.districts.flatMap(d => d.decay.placements).find(p => p.assetId === 'kit.dispersal-platform')!, courier = cure.entities.get(1)!;
    Object.assign(courier.transform, { x: platform.position[0] + 8.2, y: .705, z: platform.position[2] });
    cure.physics.playerBody!.setTranslation(courier.transform, true); cure.solids.remember(courier, `ramp-traversal:${platform.id}`); cure.player!.locomotion.reset();
    let platformTop = courier.transform.y;
    for (let tick = 0; tick < 100; tick++) { cure.setInput({ move: { x: -1, z: 0 } }); cure.update(); platformTop = Math.max(platformTop, courier.transform.y); }
    cure.clearInput();
    expect(courier.transform.x, `${quality} dispersal stair reaches its deck`).toBeLessThan(platform.position[0] + 4.6);
    expect(platformTop, `${quality} dispersal stair reaches the raised platform`).toBeGreaterThan(3.5);
  }
}

/** Bodies and light props at the lips and bends must not turn a traversable ramp into a fixed wall. */
async function rampContacts(quality: 'low' | 'high'): Promise<void> {
  const w = await slopeWorld('L3', quality), player = w.entities.get(1)!;
  const ramp = w.districts!.districts.flatMap(d => d.decay.placements).find(p => p.id === 'kit.highway-onramp:991')!;
  const points: [number, number, number][] = [[139, 0, 0], ...Array.from({ length: 61 }, (_, i) => highwayPoint(ramp, 1 - i / 60))];
  const obstacles: [number, number, number][] = [[140, .15, 0], [142, .5, 0], ...[.98, .9, .75, .5, .4, .3, .15, .02].map(t => highwayPoint(ramp, t))];
  for (const [i, [x, y, z]] of obstacles.entries()) {
    w.props!.spawn({ id: `ramp-cone-${i}`, assetId: 'prop.traffic-cone', position: [x, y, z], yaw: 0, scale: [1, 1, 1], minTier: 0, maxTier: 5, allowRoad: true, lightGroup: '', visualAabb: { min: [x, y, z], max: [x, y + .65, z] } });
    for (const permanent of [false, true]) {
      const id = w.infected!.spawn('infected.runner', { x, y: y + .7, z }, { state: 'idle', offNav: true });
      w.combat!.damage.apply({ attackId: 1000 + i * 2 + Number(permanent), actionId: 'weapon.handgun', sourceId: 1, targetId: id, origin: { x, z }, direction: { x: 1, z: 0 }, base: 1000, multiplier: 1, type: 'bullet', permanent, knockback: 0, stagger: 0 });
    }
    if (i < 4) w.hazards!.debris.spawn(1000 + i, { x, z }, w.tick, { y: y + .1 });
  }
  expect(w.infected!.active.filter(e => e.health.current <= 0 && e.infected!.recoverAt >= 0)).toHaveLength(10);
  expect(w.infected!.active.filter(e => e.health.current <= 0 && e.infected!.recoverAt < 0)).toHaveLength(10);
  Object.assign(player.transform, { x: 139, y: .705, z: 0 });
  w.physics.playerBody!.setTranslation(player.transform, true); w.solids.remember(player, 'ramp-contacts'); w.player!.locomotion.reset();
  let waypoint = 1;
  for (let tick = 0; tick < 1800 && waypoint < points.length; tick++) {
    const [x, , z] = points[waypoint]!, dx = x - player.transform.x, dz = z - player.transform.z, distance = Math.hypot(dx, dz) || 1;
    w.setInput({ move: { x: dx / distance, z: dz / distance } }); w.update();
    if (Math.hypot(x - player.transform.x, z - player.transform.z) < .4) waypoint++;
  }
  w.clearInput();
  expect(waypoint, `${quality} courier pushes light props past the entry lips and bends, crossing downed infected, corpses and debris`).toBe(points.length);
  expect(player.transform.y).toBeGreaterThan(6.3);
  expect(w.props!.items.filter(p => p.id.startsWith('ramp-cone-')).some(p => Math.hypot(p.pose.p[0] - p.home.p[0], p.pose.p[2] - p.home.p[2]) > .5)).toBe(true);
  const { x, z } = player.transform;
  const below = w.props!.spawn({ id: 'under-deck-cone', assetId: 'prop.traffic-cone', position: [x + .5, 0, z], yaw: 0, scale: [1, 1, 1], minTier: 0, maxTier: 5, allowRoad: true, lightGroup: '', visualAabb: { min: [x, 0, z], max: [x + 1, .65, z] } });
  w.props!.pushSpeed({ ...w.inputFrame, move: { x: 1, z: 0 } });
  expect(below.body.isSleeping(), 'walking on the deck cannot shove a light prop on the street below').toBe(true);
  expect(below.body.linvel().x).toBe(0);
}

/** Keep production level transforms, static colliders, Rapier, and movement input;
 * mission cinematics and actor crowds are covered by the native route/browser audit. */
async function slopeWorld(level: 'L3' | 'L5' | 'L6' | 'L7' | 'L10', quality: 'low' | 'high'): Promise<SimWorld> {
  const world = new SimWorld(); worlds.push(world); await world.init();
  const composition = compositions[level];
  world.loadComposition(composition, composition.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), 1);
  world.l7Encounters = null; world.l7Departure = null; world.l10Encounters = null;
  world.infected!.director.setTier(quality); world.npcs!.setQuality(quality);
  world.player!.locomotion.crowd = []; world.player!.locomotion.props = [];
  return world;
}

test('walls: a 72-direction capsule sweep never penetrates the wall ring; sliding keeps 60 % tangential speed; head-on corners slip', async () => {
  const w = await setup('survivor-ring');
  for (let i = 0; i < 72; i++) {
    const angle = i * Math.PI * 2 / 72;
    w.entities.get(1)!.transform.x = w.entities.get(1)!.transform.z = 0;
    w.physics.playerBody!.setTranslation(w.entities.get(1)!.transform, true); w.physics.update();
    w.player!.locomotion.reset(); w.setInput({ move: { x: Math.cos(angle), z: Math.sin(angle) } });
    for (let tick = 0; tick < 150; tick++) {
      w.update(); const p = w.entities.get(1)!.transform;
      expect(Math.max(Math.abs(p.x), Math.abs(p.z)) + survivor.radius - 5, `direction ${i}, tick ${tick}`).toBeLessThanOrEqual(0.02);
    }
  }
  const s = await setup('survivor-ring');
  s.entities.get(1)!.transform.x = 4.6; s.entities.get(1)!.transform.z = -3;
  s.physics.playerBody!.setTranslation(s.entities.get(1)!.transform, true); s.physics.update();
  s.setInput({ move: { x: 1, z: 1 } }); step(s, 30);
  const start = s.entities.get(1)!.transform.z; step(s, 30);
  expect((s.entities.get(1)!.transform.z - start) / 0.5).toBeGreaterThanOrEqual(0.6 * 4.5 / Math.SQRT2);
  await cornerSlip();
});

test('health: invulnerability window, delayed regeneration, one death event, respawn at the last checkpoint with level state kept', async () => {
  const w = await setup(), player = w.player!;
  expect(player.damage(20, w.tick)).toBe(20);
  for (let tick = 1; tick < 36; tick++) { step(w, 1); expect(player.damage(20, w.tick)).toBe(0); }
  step(w, 1); expect(player.damage(10, w.tick)).toBe(10);
  step(w, 239); expect(player.entity.health.current).toBe(70);
  step(w, 60); expect(player.entity.health.current).toBeCloseTo(72);
  step(w, 2000); expect(player.entity.health.current).toBe(100);

  const d = await setup(), p = d.player!;
  d.mission = { completedObjectives: ['pharmacy'] }; d.progression = { pickups: ['bat', 'medkit'] };
  p.setCheckpoint({ x: -2, y: 0.705, z: 3 }); p.setCheckpoint({ x: 4, y: 0.705, z: -2 });
  const retained = { mission: structuredClone(d.mission), progression: structuredClone(d.progression) };
  p.damage(100, d.tick); p.damage(100, d.tick);
  expect(d.events.events().filter(e => e.type === 'player.died')).toHaveLength(1);
  d.setInput({ move: { x: 1, z: 0 } }); step(d, 119);
  expect(p.entity.health.current).toBe(0);
  d.clearInput(); step(d, 1);
  expect(p.entity.transform.x).toBeCloseTo(4); expect(p.entity.transform.z).toBeCloseTo(-2);
  expect(p.entity.health.current).toBe(100);
  expect({ mission: d.mission, progression: d.progression }).toEqual(retained);
});

// r2-bike: keyboard movement held head-on into a post or a box corner sidesteps round it instead of stopping dead; a long
// wall still stops her, she never overlaps either solid, and open-ground speed is unchanged.
async function cornerSlip(): Promise<void> {
  const run = async (halfZ: number, centreZ: number) => {
    const w = await setup(), world = w.physics.world!;
    world.createCollider(RAPIER.ColliderDesc.cuboid(.15, 1, halfZ).setTranslation(3, 1, centreZ));
    world.step();
    w.setInput({ move: { x: 1, z: 0 } });
    let minGap = Infinity;
    for (let tick = 0; tick < 150; tick++) {
      w.update(); const p = w.entities.get(1)!.transform;
      minGap = Math.min(minGap, Math.hypot(Math.max(0, Math.abs(p.x - 3) - .15), Math.max(0, Math.abs(p.z - centreZ) - halfZ)) - survivor.radius);
      if (tick === 12) expect(w.player!.locomotion.displacement.x * 60, 'open ground keeps full run speed').toBeCloseTo(survivor.speed, 1);
    }
    return { ...w.entities.get(1)!.transform, minGap };
  };
  const post = await run(.15, 0);
  expect(post.x, 'past the post').toBeGreaterThan(5); expect(post.minGap).toBeGreaterThan(-.02);
  // The courier's line runs 1.05 m inside a 2.8 m fence panel (the L1 house-a lot west of the depot apron).
  const corner = await run(1.4, -1.05);
  expect(corner.x, 'round the lot corner').toBeGreaterThan(5); expect(corner.minGap).toBeGreaterThan(-.02);
  const wall = await run(6, 0);
  expect(wall.x, 'a long wall stops her').toBeLessThan(3 - .15 - survivor.radius + .02); expect(Math.abs(wall.z)).toBeLessThan(.05);
}
