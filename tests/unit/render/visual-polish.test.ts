import { expect, test, vi } from 'vitest';
import { BufferGeometry, Group, InstancedMesh, Mesh, MeshBasicNodeMaterial, PerspectiveCamera, Scene, Vector2, type Node } from 'three/webgpu';
import { AssetRegistry } from '../../../src/assets/registry';
import { AmbientLife } from '../../../src/render/AmbientLife';
import { Lighting } from '../../../src/render/Lighting';
import { Materials } from '../../../src/render/Materials';
import { preRender } from '../../../src/render/PreRenderer';
import type { Renderer } from '../../../src/render/Renderer';
import { seeThrough, seeThroughKeep } from '../../../src/render/SeeThrough';
import { waitingIdle, idleOffset } from '../../../src/render/npc/waitingIdle';

for (const id of ['wpn.fists', 'wpn.kick']) test(`PO #40 ${id} has no geometry, load request or placeholder warning`, async () => {
  const load = vi.fn(async () => new Group()), log = vi.fn(), warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const registry = new AssetRegistry(log, { load });
  try {
    for (const lod of ['lod0', 'lod1', 'lod2'] as const) {
      const model = await registry.loadAsset(id, lod);
      let meshes = 0; model.traverse(node => { if (node instanceof Mesh) meshes++; });
      expect(meshes).toBe(0); expect(model.userData.placeholder).toBeUndefined();
    }
    expect(load).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled(); expect(warning).not.toHaveBeenCalled();
  } finally { warning.mockRestore(); await registry.dispose(); }
});

test('PO #40 empty streamed hero slots never reach compilation or the warm-up draw', async () => {
  const scene = new Scene(), mesh = new InstancedMesh(new BufferGeometry(), new MeshBasicNodeMaterial(), 2);
  mesh.visible = false; mesh.count = 0; scene.add(mesh);
  const check = () => { expect(mesh.visible).toBe(false); expect(mesh.count).toBe(0); };
  const renderer = { selectedBackend: 'webgl', getSize: (v: Vector2) => v.set(100, 100), setSize() {}, finishWarmUp: async () => {}, compileAsync: async () => check() } as unknown as Renderer;
  await preRender(renderer, scene, new PerspectiveCamera(), check);
  check(); mesh.geometry.dispose(); (mesh.material as MeshBasicNodeMaterial).dispose(); mesh.dispose();
});

test('PO #4 ambient world trajectories depend on camera focus only inside whole-field recycling', () => {
  const lighting = new Lighting(new Scene()), materials = new Materials(lighting), life = new AmbientLife(materials, { leaf: 3, dust: 0, bird: 0 });
  try {
    const positions = (life.children[0] as Mesh<BufferGeometry, MeshBasicNodeMaterial>).material.positionNode!;
    let dependencies = 0;
    const walk = (node: Node, recycled: boolean, ancestors: Set<Node>) => {
      if (ancestors.has(node)) return;
      const path = new Set(ancestors); path.add(node);
      const inside = recycled || (node as Node & { method?: string }).method === 'floor';
      if (node === life.focus) { dependencies++; expect(inside, 'camera must not translate visible leaves').toBe(true); return; }
      for (const child of node.getChildren()) walk(child, inside, path);
    };
    walk(positions, false, new Set()); expect(dependencies).toBeGreaterThan(0);
  } finally { life.dispose(); materials.dispose(); lighting.dispose(); }
});

test('PO #24 neighbours wait with varied quiet gestures and widely spaced phases', () => {
  const ids = Array.from({ length: 8 }, (_, i) => i + 240);
  expect(new Set(ids.map(waitingIdle)).size).toBe(4);
  expect(ids.map(waitingIdle)).not.toContain('npc-gesture');
  expect(new Set(ids.map(id => Math.floor(idleOffset(id)))) .size).toBe(4);
  for (const id of ids) { expect(idleOffset(id)).toBe(idleOffset(id)); expect(idleOffset(id)).toBeGreaterThanOrEqual(0); expect(idleOffset(id)).toBeLessThan(4); }
});

test('PO #5 @E18 the reveal shader preserves the raised sidewalk above the feet', () => {
  const offsets: number[] = [], seen = new Set<Node>();
  const walk = (node: Node) => {
    if (seen.has(node)) return; seen.add(node);
    const operator = node as Node & { op?: string; aNode?: Node; bNode?: Node & { value?: number } };
    if (operator.op === '+' && operator.aNode === seeThrough.floor && typeof operator.bNode?.value === 'number') offsets.push(operator.bNode.value);
    for (const child of node.getChildren()) walk(child);
  };
  walk(seeThroughKeep());
  expect(offsets.some(height => height >= .25 && height <= .3), 'the 20 cm Grove paving must stay below the reveal cutoff').toBe(true);
});
