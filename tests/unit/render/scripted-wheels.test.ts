import { expect, test, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshLambertNodeMaterial } from 'three/webgpu';
import { EntityAssets } from '../../../src/render/EntityAssets';
import type { SimWorld } from '../../../src/sim/world/SimWorld';
vi.mock('../../../src/assets/registry', () => ({ AssetRegistry: class {
  definition() { return { lods: { lod1: 'test', lod2: 'test' } }; }
  async loadAsset() {
    const source = new Group(), material = new MeshLambertNodeMaterial({ color: '#dddddd' }); material.name = 'pal_sidewalk';
    source.add(new Mesh(new BoxGeometry(8, 2, 2), material));
    for (const [name, x, z] of [['wheelFL', 2.4, 1.1], ['wheelFR', 2.4, -1.1], ['wheelRL', -2.95, 1.1], ['wheelRR', -2.95, -1.1]] as const) {
      const pivot = new Group(); pivot.name = name; pivot.position.set(x, .52, z);
      pivot.add(new Mesh(new BoxGeometry(1.04, 1.04, .25), material)); source.add(pivot);
    }
    return source;
  }
  async dispose() {}
} }));
for (const low of [false, true]) test(`scripted bus wheels roll with interpolated distance, stop and retain spin across LOD swaps (${low})`, async () => {
  const player = { id: 1, transform: { x: 0, y: .7, z: 0, yaw: 0 } };
  const bus = { id: 2, kind: 'setpiece', archetype: 'veh.evac-bus', health: { current: 100 }, transform: { x: 0, y: .7, z: 0, yaw: 0 } };
  const world = { tick: 0, entities: { get: (id: number) => id === 1 ? player : bus, iterate: () => [player, bus] } } as unknown as SimWorld;
  const view = new EntityAssets(world, low);
  try {
    await view.ready(); view.update();
    let draws = 0; view.traverse(node => { if (node instanceof Mesh) draws++; });
    expect(draws).toBe(5); // body + four palette batches, regardless of authored part count
    const wheels = () => view.getState().actors[0].wheels;
    expect(wheels()).toHaveLength(4);
    bus.transform.x = 1; world.tick++; view.update(.5);
    for (const wheel of wheels()) expect(wheel.spin).toBeCloseTo(-.5 / .52);
    view.update(1); for (const wheel of wheels()) expect(wheel.spin).toBeCloseTo(-1 / .52);
    world.tick++; view.update(1); for (const wheel of wheels()) expect(wheel.spin).toBeCloseTo(-1 / .52);
    // Move the camera's subject to select another LOD without teleporting the bus.
    player.transform.x = 40; await view.ready(); view.update(1);
    for (const wheel of wheels()) expect(wheel.spin).toBeCloseTo(-1 / .52);
    bus.transform.x = 50; world.tick++; view.update(1); // teleport: no artificial wheel travel
    for (const wheel of wheels()) expect(wheel.spin).toBeCloseTo(-1 / .52);
  } finally { view.dispose(); }
});

for (const low of [false, true]) test(`scripted bus keeps the actual penultimate tick through acceleration and multiple ticks per draw (${low})`, async () => {
  const player = { id: 1, transform: { x: 0, y: .7, z: 0, yaw: 0 } };
  const bus = { id: 2, kind: 'setpiece', archetype: 'veh.evac-bus', health: { current: 100 }, transform: { x: 0, y: .7, z: 0, yaw: 0 } };
  const world = { tick: 0, entities: { get: (id: number) => id === 1 ? player : bus, iterate: () => [player, bus] } } as unknown as SimWorld;
  const view = new EntityAssets(world, low);
  try {
    await view.ready(); view.update();
    for (const x of [.1, .3, .6]) { world.tick++; bus.transform.x = x; view.advance(); }
    view.update(0);
    expect(view.getState().actors[0].position[0]).toBeCloseTo(.3, 9);
    view.update(.5);
    expect(view.getState().actors[0].position[0]).toBeCloseTo(.45, 9);
    for (const wheel of view.getState().actors[0].wheels) expect(wheel.spin).toBeCloseTo(-.45 / .52);
  } finally { view.dispose(); }
});
