import { expect, test } from 'vitest';
import { Group, Mesh, BoxGeometry, MeshBasicNodeMaterial } from 'three/webgpu';
import { L2Props } from '../../../src/render/L2Props';
import { ObjectiveMarker } from '../../../src/render/ObjectiveMarker';
import { ActionView } from '../../../src/render/ActionView';
import { action } from '../../../src/data/actions/catalog';

test('weapon pickup ring draws above occluders without writing depth or changing colour in fog', () => {
  const entity = { id: 2, transform: { x: 0, z: 0, yaw: 0 }, pickup: { actionId: 'weapon.fire-axe', surfaceY: 0 } };
  const world = { entities: { *iterate() { yield entity; }, get: () => entity } };
  const view = new ActionView(world as never, {} as never, undefined as never, undefined as never);
  const internal = view as unknown as { assets: Map<string, unknown>; updatePickups(): void };
  const model = new Group(), geometry = new BoxGeometry(.1, .8, .2), material = new MeshBasicNodeMaterial();
  model.add(new Mesh(geometry, material));
  internal.assets.set(action('weapon.fire-axe').viewAssetId, { model, source: 'glb', reason: null });
  try {
    internal.updatePickups();
    let ring: Mesh | undefined;
    view.traverse(node => { if (node instanceof Mesh && node.geometry.type === 'RingGeometry') ring = node; });
    expect(ring).toBeDefined();
    expect(ring!.scale.x).toBe(1);
    expect(ring!.renderOrder).toBeGreaterThan(90);
    expect(ring!.material).toMatchObject({ depthTest: false, depthWrite: false, fog: false, toneMapped: false });
  } finally { view.dispose(); geometry.dispose(); material.dispose(); }
});

test('mission rings sit behind surface occluders while the overhead arrow stays visible', () => {
  const marker = new ObjectiveMarker({} as never);
  try {
    expect(marker.children).toHaveLength(2);
    for (const [index, child] of (marker.children as Mesh[]).entries()) {
      expect(child.renderOrder).toBeGreaterThan(90);
      expect(child.material).toMatchObject({ depthTest: index === 0, depthWrite: false, toneMapped: false, fog: false });
    }
  } finally { marker.dispose(); }
});

test('ground pickup keeps its full ring while its weapon model is still loading', () => {
  const entity = { id: 2, transform: { x: 0, z: 0, yaw: 0 }, pickup: { actionId: 'weapon.fire-axe', surfaceY: 0 } };
  const world = { entities: { *iterate() { yield entity; }, get: () => entity } };
  const view = new ActionView(world as never, {} as never, undefined as never, undefined as never);
  const internal = view as unknown as { model(): null; updatePickups(): void };
  internal.model = () => null;
  try {
    internal.updatePickups();
    const rings: Mesh[] = [];
    view.traverse(node => { if (node instanceof Mesh && node.geometry.type === 'RingGeometry') rings.push(node); });
    expect(rings).toHaveLength(1);
    expect(rings[0].visible).toBe(true);
    expect(rings[0].scale.x).toBe(1);
  } finally { view.dispose(); }
});

test('L2 axe highlight pulses as a border without painting over the axe', () => {
  const world = { tick: 0, missions: { state: { l2: { phase: 'calm', axe: false, alarmAt: 0, doorsOpenAt: 0, crossedAt: 0 }, steps: { axe: { status: 'active' } } } } };
  const material = new MeshBasicNodeMaterial();
  const view = new L2Props(world as never, { get: () => material } as never);
  const frame = (view as unknown as { glint: Group }).glint;
  try {
    expect(frame.children).toHaveLength(4);
    for (const tick of [0, 16, 36, 60]) {
      world.tick = tick; view.update();
      for (const edge of frame.children as Mesh[]) {
        expect(Math.min(edge.scale.y, edge.scale.z)).toBeLessThan(.1);
        expect(edge.material).toMatchObject({ depthTest: false, depthWrite: false });
      }
    }
  } finally { view.dispose(); material.dispose(); }
});
