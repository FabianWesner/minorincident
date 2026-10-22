import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { Box3, Matrix4, Mesh, Vector3, type BufferGeometry, type Group, type InstancedMesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { deinterleaveGeometry, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import manifest from '../../../src/assets/manifest.json';
import { AssetRegistry } from '../../../src/assets/registry';
import { CrowdAccessories, bakedSkull } from '../../../src/render/characters/CrowdAccessories';
import { bakeInfected } from '../../../src/render/characters/bakeInfected';
import { markCrowdAppearance, resolveCrowdAppearance } from '../../../src/render/characters/CrowdAppearance';
import { regularInfectedModels } from '../../../src/data/crowdAppearance';
import { characterNodes } from '../../../src/data/survivor';
import { packCrowdParts } from '../../../src/assets/crowdParts';
import type { EntitySnapshot } from '../../../src/sim/world/types';
import type { CrowdPosePalette } from '../../../src/render/characters/CrowdPosePalette';
import { oracle } from './oracles';

type Lod = 'lod0' | 'lod1' | 'lod2';
const cache = new Map<string, Promise<Group>>();
async function asset(id: string, lod: Lod): Promise<Group> {
  const key = `${id}/${lod}`;
  if (!cache.has(key)) cache.set(key, (async () => {
    const def = manifest.find(a => a.id === id)!;
    const bytes = readFileSync(lod === 'lod0' ? def.glb : def.lods![lod]!);
    const parsed = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), ''), { scene } = parsed;
    scene.traverse(node => { const index = parsed.parser.associations.get(node)?.nodes; if (index !== undefined) node.name = parsed.parser.json.nodes[index].name ?? node.name; });
    scene.userData.assetId = id; return scene;
  })());
  return (await cache.get(key)!).clone(true);
}
function bounds(geometry: BufferGeometry, matrix = new Matrix4(), selected?: (i: number) => boolean): Box3 {
  const result = new Box3(), point = new Vector3(), p = geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) if (!selected || selected(i)) result.expandByPoint(point.fromBufferAttribute(p, i).applyMatrix4(matrix));
  return result;
}
async function authoredBounds(id: string, lod: Lod): Promise<Box3> {
  const root = await asset(id, lod === 'lod2' ? 'lod1' : lod); root.updateMatrixWorld(true);
  const pivot = root.getObjectByName('head'), inverse = pivot && !(pivot instanceof Mesh) ? pivot.matrixWorld.clone().invert() : new Matrix4();
  const result = new Box3();
  root.traverse(node => { if (node instanceof Mesh) result.union(bounds(node.geometry, inverse.clone().multiply(node.matrixWorld))); });
  return result;
}

test('1 accessories: actual head-local bounds and scale for every crowd model × LOD × appearance tier', async () => {
  vi.spyOn(AssetRegistry.prototype, 'loadAsset').mockImplementation((id, lod) => asset(id, lod === 'lod1' || lod === 'lod2' ? lod : 'lod0'));
  const renderer = new CrowdAccessories();
  const errors: string[] = [];
  try {
    await renderer.init();
    const referenceRoot = await asset('npc.civilian-man-a', 'lod1');
    const referenceGeo = bakeInfected(referenceRoot, [], false, ['idle']).geometry;
    packCrowdParts(referenceGeo);
    markCrowdAppearance(referenceGeo, false);
    const reference = bakedSkull(referenceGeo)!;
    const ids = manifest.filter(a => a.category === 'accessory' && a.accessory && ['hat', 'glasses'].includes(a.accessory.slot)).map(a => a.id);
    expect(ids.length).toBeGreaterThan(0);
    // Group tableaux contain several people; their individually registered members are the crowd variants.
    const models = [...new Set([...regularInfectedModels, ...manifest.filter(a => a.id.startsWith('npc.') && !['npc.survivor-group', 'npc.survivor-group.aftermath'].includes(a.id)).map(a => a.id)])];
    const raw = new Map<string, Box3>();
    for (const id of ids) for (const lod of ['lod0', 'lod1', 'lod2'] as const) raw.set(`${id}/${lod}`, await authoredBounds(id, lod));
    for (const id of ids) {
      const def = manifest.find(a => a.id === id)!, size = raw.get(`${id}/lod0`)!.getSize(new Vector3());
      for (const axis of ['x', 'y', 'z'] as const) if (Math.abs(size[axis] - def.dimensions[axis]) > def.dimensions[axis] * def.dimensions.tolerance) errors.push(`${id}: GLB ${axis} extent ${size[axis]} exceeds authored ${def.dimensions[axis]} ±${def.dimensions.tolerance * 100}%`);
    }
    // Independent source: vertices in the authored GLB head frame plus its per-model manifest fit.
    // Tolerance is the source LOD's measured extent / 1024 (quantization), with a 2 mm floating-point floor.
    let combinations = 0, eligible = 0;
    for (const model of models) for (const lod of ['lod0', 'lod1', 'lod2'] as const) {
      const root = await asset(model, lod), baked = bakeInfected(root, [], false, ['idle']);
      deinterleaveGeometry(baked.geometry); const geometry = mergeVertices(baked.geometry); packCrowdParts(geometry);
      markCrowdAppearance(geometry, model.startsWith('inf.'));
      const skull = bakedSkull(geometry);
      // Glasses are authored into these civilian heads, not separate acc.* models.
      // Their dark front-face vertices must remain on the face and owned by the head joint.
      if (/npc\.civilian-(woman-b|elderly)(\.aftermath)?$/.test(model)) {
        const headNode = root.getObjectByName('head')!; root.updateMatrixWorld(true);
        const inverse = headNode.matrixWorld.clone().invert(), spectacles = new Box3(), point = new Vector3();
        headNode.traverse(node => {
          if (!(node instanceof Mesh) || Array.isArray(node.material) || !/pal_(leather|uiDark)$/.test(node.material.name)) return;
          const position = node.geometry.getAttribute('position'), index = node.geometry.index, transform = inverse.clone().multiply(node.matrixWorld);
          for (let i = 0; i < (index?.count ?? position.count); i++) {
            point.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(transform);
            if (point.x > .02 && point.y > .04) spectacles.expandByPoint(point);
          }
        });
        if (skull && !spectacles.isEmpty()) {
          const top = skull.centre.y + skull.size.y / 2;
          if (spectacles.getCenter(point).y > top + .02 || spectacles.min.y < skull.centre.y - skull.size.y / 2 - .02) errors.push(`${model}/${lod}: glasses outside skull face bounds`);
          const parts = geometry.getAttribute('_parts'), positions = geometry.getAttribute('position'); let faceVertices = 0;
          for (let i = 0; i < positions.count; i++) if (parts.getX(i) === characterNodes.indexOf('head') && spectacles.containsPoint(point.fromBufferAttribute(positions, i))) {
            faceVertices++;
          }
          expect(faceVertices, `${model}/${lod}: native glasses face survives baking`).toBeGreaterThan(0);
        }
      }
      (renderer as unknown as { fits: Map<string, Matrix4> }).fits.delete(model); renderer.registerSkull(model, geometry);
      for (const tier of ['frail', 'average', 'athletic'] as const) for (const id of ids) {
        const e = { id: 1, archetype: model.startsWith('inf.') ? 'infected.runner' : 'civilian', appearance: { entityId: 1, asset: model, accessories: [id], tier } } as EntitySnapshot;
        combinations++;
        const look = resolveCrowdAppearance(e);
        if (!look.accessory) continue; // Uniforms deliberately reject accessories in production.
        eligible++;
        const def = manifest.find(a => a.id === id)! as unknown as { accessory: { fits: Record<string, { scale: [number, number, number]; offset: [number, number, number] }> } };
        const fit = def.accessory.fits[model.replace(/\.aftermath$/, '')] ?? def.accessory.fits['npc.civilian-man-a'];
        const expectedTransform = new Matrix4().makeScale(...fit.scale).setPosition(...fit.offset);
        if (!def.accessory.fits[model.replace(/\.aftermath$/, '')]) {
          expect(skull, `${model}/${lod} skin skull`).toBeTruthy();
          const ratio = skull!.size.clone().divide(reference.size);
          expectedTransform.premultiply(new Matrix4().makeTranslation(...skull!.centre.toArray()).multiply(new Matrix4().makeScale(...ratio.toArray())).multiply(new Matrix4().makeTranslation(...reference.centre.clone().negate().toArray())));
        }
        const expected = raw.get(`${id}/${lod}`)!.clone().applyMatrix4(expectedTransform);
        const tolerance = Math.max(.002, expected.getSize(new Vector3()).length() / 1024);
        const head = new Matrix4().makeRotationY(.43).setPosition(3, 1.4, -7), world = new Matrix4().makeRotationY(-.7).setPosition(11, .2, 9);
        const poses = { clip: { parts: ['head'] }, part: (_f: number, _o: number, _w: number, _p: number, out: Matrix4) => out.copy(head) } as CrowdPosePalette;
        renderer.begin(); renderer.place(e, lod, poses, 0, [0, 1], world); renderer.finish();
        const mesh = renderer.children.find(m => m.name === `${id}:${lod === 'lod2' ? 'lod1' : lod}`) as InstancedMesh;
        const matrix = new Matrix4(); mesh.getMatrixAt(0, matrix);
        const headLocal = world.clone().multiply(head).invert().multiply(matrix);
        if (process.env.QA_INVARIANTS_BREAK === 'accessories') headLocal.premultiply(new Matrix4().makeTranslation(0, .4, 0));
        const actual = bounds(mesh.geometry, headLocal);
        if (!mesh.visible || mesh.count !== 1 || oracle.accessory({ attach: 'head', offset: [actual.min.distanceTo(expected.min), actual.max.distanceTo(expected.max)], tolerance })) errors.push(`${model}/${lod}/${tier}/${id}: head bounds ${actual.min.toArray()}..${actual.max.toArray()}, authored ${expected.min.toArray()}..${expected.max.toArray()}, tolerance ${tolerance}`);
        if (lod !== 'lod0') {
          const inline = renderer.livingSource(geometry, model, characterNodes.indexOf('head')), parts = inline.getAttribute('_parts'), slot = renderer.ids.indexOf(id) + 1;
          const inlineBounds = bounds(inline, new Matrix4(), i => Math.floor((parts.getW(i) - 128) / 8) === slot);
          if (inlineBounds.min.distanceTo(expected.min) > tolerance || inlineBounds.max.distanceTo(expected.max) > tolerance) errors.push(`${model}/${lod}/${tier}/${id}: inline head geometry differs from authored bounds`);
          inline.dispose();
        }
      }
      geometry.dispose(); baked.geometry.dispose();
    }
    console.log(`[qa:invariants] accessories combinations=${combinations} eligible=${eligible}`);
    expect(errors.slice(0, 15), `accessories invariant: ${errors.length} bad head bounds`).toEqual([]);
  } finally { renderer.dispose(); vi.restoreAllMocks(); }
}, 180_000);
