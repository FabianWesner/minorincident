import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { Box3, Vector3, Matrix4, type InstancedMesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { deinterleaveGeometry, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { regularInfectedModels } from '../../../src/data/crowdAppearance';
import { markCrowdAppearance, crowdAccessoryIds } from '../../../src/render/characters/CrowdAppearance';
import { bakeInfected } from '../../../src/render/characters/bakeInfected';
import { packCrowdParts } from '../../../src/assets/crowdParts';
import { characterNodes } from '../../../src/data/survivor';
import manifest from '../../../src/assets/manifest.json';

async function model(id: string, lod: 'lod0' | 'lod1' | 'lod2') {
  const def = manifest.find(d => d.id === id)!;
  const bytes = readFileSync(lod === 'lod0' ? def.glb : def.lods![lod]!);
  const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  scene.userData.assetId = id; return scene;
}
async function crowdGeometry(id: string, lod: 'lod1' | 'lod2') {
  const baked = bakeInfected(await model(id, lod));
  deinterleaveGeometry(baked.geometry); const geometry = mergeVertices(baked.geometry);
  packCrowdParts(geometry); markCrowdAppearance(geometry, regularInfectedModels.some(m => m === id));
  return geometry;
}

// Spec audit 10-16 (E07-AC13): "dense multicolored jagged patches cover many torsos and limbs". Ordinary infected
// hats were fitted to a fixed shell ~10 cm below the reference skull and 1.3-1.7x too tall, so they swallowed face
// and shoulders. Each unauthored head must now carry an accessory in the same skull-relative size and height as the
// authored reference civilian.
test('ordinary infected accessories keep the authored reference proportions on their own skull @E07-AC13 @E08', async () => {
  const { CrowdAccessories, bakedSkull, referenceSkull } = await import('../../../src/render/characters/CrowdAccessories');
  const { AssetRegistry } = await import('../../../src/assets/registry');
  vi.spyOn(AssetRegistry.prototype, 'loadAsset').mockImplementation((id, lod) => model(id, lod === 'lod1' || lod === 'lod2' ? lod : 'lod0'));
  const reference = bakedSkull(await crowdGeometry('npc.civilian-man-a', 'lod1'))!;
  expect(reference.size.distanceTo(referenceSkull.size)).toBeLessThan(.003);
  expect(reference.centre.distanceTo(referenceSkull.centre)).toBeLessThan(.003);
  const accessories = new CrowdAccessories(); await accessories.init();
  const relative = (model: string, skull: { size: Vector3; centre: Vector3 }, acc: string) => {
    accessories.begin();
    accessories.place({ id: 1, archetype: 'infected.runner', appearance: { asset: model, accessories: [acc] } } as never, 'lod1',
      { clip: { parts: ['head'] }, part: (_f: number, _o: number, _w: number, _p: number, out: Matrix4) => out.identity() } as never, 0, [0, 1], new Matrix4());
    const mesh = accessories.children.find(n => n.name === `${acc}:lod1`) as InstancedMesh, matrix = new Matrix4(); mesh.getMatrixAt(0, matrix);
    const box = new Box3(), p = new Vector3(), position = mesh.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) box.expandByPoint(p.fromBufferAttribute(position, i).applyMatrix4(matrix));
    const bottom = skull.centre.y - skull.size.y / 2;
    return { size: box.getSize(new Vector3()).divide(skull.size), bottom: (box.min.y - bottom) / skull.size.y, top: (box.max.y - bottom) / skull.size.y };
  };
  const ids = crowdAccessoryIds.filter(id => !id.startsWith('acc.placeholder-'));
  expect(ids.length).toBeGreaterThan(0);
  const expected = new Map(ids.map(acc => [acc, relative('npc.civilian-man-a', reference, acc)]));
  for (const id of regularInfectedModels) for (const lod of ['lod1', 'lod2'] as const) {
    const geometry = await crowdGeometry(id, lod), skull = bakedSkull(geometry)!;
    // The model's own hair/caps must hide under a shared accessory: nothing above the eyes stays unmasked.
    const parts = geometry.getAttribute('_parts'), position = geometry.getAttribute('position');
    let eyeTop = -Infinity, exposed = 0, masked = 0;
    for (let i = 0; i < parts.count; i++) if (parts.getX(i) === characterNodes.indexOf('head') && parts.getZ(i) > 0) eyeTop = Math.max(eyeTop, position.getY(i));
    for (let i = 0; i < parts.count; i++) if (parts.getX(i) === characterNodes.indexOf('head') && parts.getY(i) === 0 && parts.getZ(i) <= 0) {
      if (parts.getW(i) >= 4) masked++; else if (position.getY(i) > eyeTop + .06) exposed++;
    }
    expect(exposed, `${id} ${lod} unmasked own headwear`).toBe(0); expect(masked, `${id} ${lod} masked own headwear`).toBeGreaterThan(0);
    // CrowdView keeps the first registered LOD per model; check each LOD's own fit.
    (accessories as unknown as { fits: Map<string, Matrix4> }).fits.delete(id); accessories.registerSkull(id, geometry);
    for (const acc of ids) {
      const got = relative(id, skull, acc), want = expected.get(acc)!;
      for (const axis of ['x', 'y', 'z'] as const) expect(got.size[axis], `${id} ${lod} ${acc} ${axis}`).toBeCloseTo(want.size[axis], 2);
      expect(got.bottom, `${id} ${lod} ${acc} bottom`).toBeCloseTo(want.bottom, 2);
      expect(got.top, `${id} ${lod} ${acc} top`).toBeCloseTo(want.top, 2);
    }
  }
  accessories.dispose();
}, 120000);
