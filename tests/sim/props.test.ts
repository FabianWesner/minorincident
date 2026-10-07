import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, test } from 'vitest';
import { compositions } from '../../src/levels/compositions';
import type { DistrictLayout } from '../../src/levels/districts/types';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { stateHash } from '../../src/sim/world/stateHash';
import { bakeNav } from '../../src/sim/world/NavGrid';
import { placementColliders } from '../../src/levels/districts/staticCollision';
import { MAX_AWAKE_PROPS, type PushProp } from '../../src/sim/interact/PropSystem';

const layout = JSON.parse(readFileSync('public/assets/layouts/D-GROVE.layout.json', 'utf8')) as DistrictLayout;
const worlds: SimWorld[] = [];
afterEach(() => { for (const w of worlds.splice(0)) w.dispose(); });
async function grove() {
  const world = new SimWorld(); worlds.push(world); await world.init();
  world.loadComposition(compositions['D-GROVE'], [layout], 1);
  if (world.combat) world.combat.damage.god = true;
  return world;
}
const step = (world: SimWorld, n: number) => { for (let i = 0; i < n; i++) world.update(); };
function teleport(world: SimWorld, p: { x: number; z: number }) {
  const e = world.entities.get(1)!; Object.assign(e.transform, { x: p.x, y: .705, z: p.z });
  world.physics.playerBody!.setTranslation(e.transform, true); world.player!.locomotion.reset(); world.spatial.set(1, p.x, p.z); world.physics.update();
}
/** A pushable with a clear 3 m nav run-up on one side; returns the prop and the unit push direction. */
function runUp(world: SimWorld, assetId: string): { prop: PushProp; dir: { x: number; z: number } } {
  const nav = world.districts!.nav;
  for (const prop of world.props!.items.filter(i => i.assetId === assetId)) {
    for (const dir of [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }]) {
      const [x, , z] = prop.home.p;
      const clear = [1, 1.5, 2, 2.5, 3].every(d => nav.walkable([x - dir.x * (prop.radius + d), z - dir.z * (prop.radius + d)]))
        && [1, 1.5, 2].every(d => nav.walkable([x + dir.x * (prop.radius + d), z + dir.z * (prop.radius + d)]));
      if (clear) return { prop, dir };
    }
  }
  throw new Error(`No clear ${assetId}`);
}
async function push(assetId = 'prop.trash-bin') {
  const world = await grove();
  const { prop, dir } = runUp(world, assetId), [x, , z] = prop.home.p;
  teleport(world, { x: x - dir.x * (prop.radius + 2.5), z: z - dir.z * (prop.radius + 2.5) }); step(world, 2);
  world.setInput({ move: dir }); step(world, 75); world.setInput({ move: { x: 0, z: 0 } });
  return { world, prop, dir };
}

describe('E26 authored pushable props', () => {
  test('a fallen knocked prop keeps its ID, displaced location and health', async () => {
    const world = await grove(), prop = world.props!.items.find(p => !p.fixed)!;
    const hp = world.entities.get(prop.entityId)!.health.current, x = prop.home.p[0] + 3, z = prop.home.p[2] + 3;
    prop.body.setTranslation({ x, y: -6, z }, true); world.props!.postPhysics();
    expect(world.entities.get(prop.entityId)!.health.current).toBe(hp);
    expect(prop.body.isEnabled()).toBe(true); expect(prop.pose.p[0]).toBe(x); expect(prop.pose.p[2]).toBe(z);
    expect(prop.pose.p[1]).toBeGreaterThan(0);
  });
  test('authored movable props are dynamic, sleeping bodies outside the static collision and nav bake', async () => {
    const world = await grove();
    const props = world.props!.items;
    expect(props.length).toBeGreaterThan(40);
    expect(props.filter(p => !p.fixed).every(p => p.body.isDynamic() && p.body.isSleeping())).toBe(true);
    // Only placements authored into static geometry stay fixed.
    expect(props.filter(p => p.fixed).every(p => p.body.isFixed())).toBe(true);
    const ids = new Set(props.map(p => p.id.split('/')[1]));
    for (const d of world.districts!.districts) expect(d.decay.colliders.some(c => ids.has(c.id.split('/')[0]))).toBe(false);
    // Medium and heavy props now follow their authored permission; buildings/vehicles retain their systems.
    expect(props.some(p => p.assetId === 'prop.bench')).toBe(true);
    expect(props.some(p => /hydrant|lamp|veh\./.test(p.assetId))).toBe(false);
    // Pushed props never block paths: the nav bake ignores them (a bake that included them has fewer open cells).
    const open = (nav: { cells: Uint8Array }) => nav.cells.reduce((n, c) => n + (c ? 1 : 0), 0);
    const withProps = bakeNav(world.districts!.districts.map(d => ({ layout: d.layout, origin: d.origin,
      colliders: d.decay.colliders.filter(c => !c.walkable).map(c => c.aabb).concat(d.blockers, placementColliders(d.pushables, []).map(c => c.aabb)) })), 1, .5);
    expect(open(world.districts!.nav)).not.toBe(open(withProps));
    const home = props.filter(p => world.districts!.nav.walkable([p.home.p[0], p.home.p[2]])).length;
    expect(home).toBeGreaterThan(props.filter(p => withProps.walkable([p.home.p[0], p.home.p[2]])).length);
  });

  test('walking into a trash bin shoves it along, it settles and sleeps; the courier keeps moving', async () => {
    const { world, prop, dir } = await push();
    const moved = (prop.pose.p[0] - prop.home.p[0]) * dir.x + (prop.pose.p[2] - prop.home.p[2]) * dir.z;
    expect(moved).toBeGreaterThan(.3);
    const player = world.entities.get(1)!.transform, start = prop.home.p;
    // The courier got past the bin's original front face (not stopped dead like a static wall).
    expect((player.x - start[0]) * dir.x + (player.z - start[2]) * dir.z).toBeGreaterThan(-prop.radius - .6);
    step(world, 400);
    expect(prop.awake).toBe(false);
    expect(prop.pose.p[1]).toBeGreaterThan(-.2);
    expect(world.getState().props!.some(p => p.id === prop.id)).toBe(true);
  });

  test('push is deterministic (identical prop poses and state hash across runs)', async () => {
    const a = await push(), b = await push();
    step(a.world, 30); step(b.world, 30);
    expect(a.world.getState().props).toEqual(b.world.getState().props);
    expect(stateHash(a.world.getState())).toBe(stateHash(b.world.getState()));
  });

  test('infected shove props on contact; awake bodies stay capped', async () => {
    const world = await grove();
    const { prop, dir } = runUp(world, 'prop.trash-bin'), [x, , z] = prop.home.p;
    const id = world.entities.create({ kind: 'infected', archetype: 'infected.walker', transform: { x: x - dir.x * (prop.radius + .2), y: .7, z: z - dir.z * (prop.radius + .2), yaw: 0 }, health: { current: 10, max: 10 }, faction: 'infected' }).id;
    world.entities.get(id)!.infected = {} as never; world.spatial.set(id, x - dir.x * (prop.radius + .2), z - dir.z * (prop.radius + .2));
    world.props!.prePhysics(); world.physics.update(); world.props!.postPhysics();
    expect(prop.body.isSleeping()).toBe(false);
    expect(prop.body.linvel().x * dir.x + prop.body.linvel().z * dir.z).toBeGreaterThan(1);
    world.entities.get(id)!.health.current = 0;
    for (const item of world.props!.items) item.body.wakeUp();
    step(world, 1);
    expect(world.props!.items.filter(i => i.awake).length).toBeLessThanOrEqual(MAX_AWAKE_PROPS);
  });

  test('checkpoint seam restores displaced props and survives a tier rebuild', async () => {
    const { world, prop } = await push();
    step(world, 400);
    const saved = world.props!.snapshot(), pose = structuredClone(prop.pose);
    world.props!.restore([]);
    expect(prop.pose).toEqual(prop.home);
    world.props!.restore(saved);
    expect(prop.pose).toEqual(pose);
    for (const tier of [1, 2, 3, 4, 5] as const) {
      world.setTier(tier);
      const rebuilt = world.props!.items.find(i => i.id === prop.id)!;
      expect(rebuilt).toBeDefined(); expect(rebuilt.entityId).toBe(prop.entityId);
      expect(rebuilt.pose.p).toEqual(pose.p); expect(rebuilt.body.translation().x).toBeCloseTo(pose.p[0], 4);
    }
  });
});
