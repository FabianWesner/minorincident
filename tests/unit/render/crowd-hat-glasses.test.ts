import { stripGlbTextures } from '../../../tools/assets/stripGlbTextures';
import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { Box3, Vector3, Matrix4, Texture, Mesh, type InstancedMesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { markCrowdAppearance, crowdAccessoryIds } from '../../../src/render/characters/CrowdAppearance';
import { prepareCivilianGeometry, prepareCivilianRig } from '../../../src/render/npc/prepareCivilianGeometry';
import { l1Pedestrians } from '../../../src/data/npcs';
import manifest from '../../../src/assets/manifest.json';

async function model(id: string, lod: 'lod0' | 'lod1' | 'lod2') {
  const def = manifest.find(d => d.id === id)!;
  const bytes = readFileSync(lod === 'lod0' ? def.glb : def.lods![lod]!);
  const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(stripGlbTextures(bytes), '');
  scene.userData.assetId = id;
  if (def.crowdSkin) scene.traverse(node => { if (node instanceof Mesh && !Array.isArray(node.material) && node.material.name === 'tex_baseColor') (node.material as import('three').MeshStandardMaterial).map = new Texture(); });
  return scene;
}

// PO 2026-10-22 #108 "Glasses are on the hat" (L1, civilian-woman-b with a pale sun hat: the frames poked out through
// the crown) and #115 (L4, "huge flat hexagonal hats cover their whole heads"). Every civilian crowd variant, at every
// LOD the crowd draws, wears every hat anchored on its own head at head scale, and a spectacled head wears it above
// its frames.
test('T-PO108 civilian hats sit on the head at head scale and above the glasses on every LOD @E07 @E19', async () => {
  const { CrowdAccessories, bakedSkull, glassesTop, glassesClearance, spectacleTops, skinnedBrow } = await import('../../../src/render/characters/CrowdAccessories');
  const { AssetRegistry } = await import('../../../src/assets/registry');
  vi.spyOn(AssetRegistry.prototype, 'loadAsset').mockImplementation((id, lod) => model(id, lod === 'lod1' || lod === 'lod2' ? lod : 'lod0'));
  const accessories = new CrowdAccessories(); await accessories.init();
  const hats = crowdAccessoryIds.filter(id => id.startsWith('acc.hat-'));
  expect(hats.length).toBeGreaterThanOrEqual(6);
  const bake = async (id: string, lod: 'lod0' | 'lod1' | 'lod2') => {
    const m = await model(id, lod); prepareCivilianRig(m, id);
    const baked = await prepareCivilianGeometry(m, id, lod !== 'lod0'); baked.geometry.userData.crowdLod = lod; markCrowdAppearance(baked.geometry);
    return baked.geometry;
  };
  const fitted = (id: string, lod: 'lod0' | 'lod1' | 'lod2', hat: string) => {
    accessories.begin();
    accessories.place({ id: 1, archetype: 'civilian', civilian: {}, appearance: { asset: id, accessories: [hat] } } as never, lod,
      { clip: { parts: ['head'] }, part: (_f: number, _o: number, _w: number, _p: number, out: Matrix4) => out.identity() } as never, 0, [0, 1], new Matrix4());
    const mesh = accessories.children.find(n => n.name === `${hat}:${manifest.find(d => d.id === id)?.crowdSkin ? 'lod0' : lod === 'lod2' ? 'lod1' : lod}`) as InstancedMesh, matrix = new Matrix4(); mesh.getMatrixAt(0, matrix);
    if (manifest.find(d => d.id === id)?.crowdSkin) expect(matrix.elements[1], `${id} ${hat} front brim clears the eyes`).toBeGreaterThan(0);
    const box = new Box3(), p = new Vector3(), position = mesh.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) box.expandByPoint(p.fromBufferAttribute(position, i).applyMatrix4(matrix));
    return box;
  };
  // Register every LOD first, as the game does before any hat is drawn.
  const geometries = new Map<string, Awaited<ReturnType<typeof bake>>>();
  for (const id of l1Pedestrians.models) for (const lod of ['lod0', 'lod1', 'lod2'] as const) { const g = await bake(id, lod); geometries.set(`${id}:${lod}`, g); accessories.registerSkull(id, g); }
  const retarget = vi.spyOn(accessories as unknown as { authoredOrRetargeted(id: string, model: string): void }, 'authoredOrRetargeted');
  const first = fitted('npc.civilian-man-a', 'lod1', hats[0]);
  for (let repeat = 0; repeat < 5; repeat++) expect(fitted('npc.civilian-man-a', 'lod1', hats[0]).equals(first)).toBe(true);
  expect(retarget).toHaveBeenCalledTimes(1);
  // Replacing the registered skull invalidates the completed fit as well as its frame-clearance lift.
  (accessories as unknown as { fits: Map<string, Matrix4> }).fits.delete('npc.civilian-man-a');
  accessories.registerSkull('npc.civilian-man-a', geometries.get('npc.civilian-man-a:lod1')!);
  const reloaded = fitted('npc.civilian-man-a', 'lod1', hats[0]);
  expect(reloaded.min.distanceTo(first.min)).toBeLessThan(.005); expect(reloaded.max.distanceTo(first.max)).toBeLessThan(.005);
  expect(retarget).toHaveBeenCalledTimes(2);
  retarget.mockRestore();
  const spectacled = l1Pedestrians.models.filter(id => glassesTop(geometries.get(`${id}:lod0`)!) !== null);
  expect(spectacled.sort()).toEqual(Object.keys(spectacleTops).sort());
  for (const id of spectacled) {
    const root = await model(id, 'lod0'); root.updateMatrixWorld(true);
    let expected = spectacleTops[id];
    if (manifest.find(d => d.id === id)?.crowdSkin) {
      const mesh = root.getObjectByName('skin_body') as import('three').SkinnedMesh;
      const region = mesh.geometry.getAttribute('_crowd_region'), position = mesh.geometry.getAttribute('position');
      const inverse = root.getObjectByName('head')!.matrixWorld.clone().invert().multiply(mesh.matrixWorld), point = new Vector3();
      expected = -Infinity;
      for (let i = 0; i < region.count; i++) if (region.getX(i) > 1.5) expected = Math.max(expected, point.fromBufferAttribute(position, i).applyMatrix4(inverse).y);
      expect(Number.isFinite(expected)).toBe(true);
    }
    expect(Math.abs(glassesTop(geometries.get(`${id}:lod0`)!)! - expected), `${id} authored frame top`).toBeLessThan(.005);
  }
  const reference = new Map(hats.map(hat => { const box = fitted('npc.civilian-man-a', 'lod0', hat), skull = bakedSkull(geometries.get('npc.civilian-man-a:lod0')!)!; return [hat, box.getSize(new Vector3()).z / skull.size.z]; }));
  // PO 2026-10-22 P1-115 "What are they doing?": brim width relative to the head (lateral and fore-aft), every base and LOD.
  const limit = (hat: string) => (hat.endsWith('sun-hat') ? 1.4 : hat.endsWith('bucket-hat') ? 1.3 : 1.15) + .03;
  for (const id of l1Pedestrians.models) for (const lod of ['lod0', 'lod1'] as const) {
    const skull = bakedSkull(geometries.get(`${id}:${lod}`)!)!, bare = skinnedBrow(geometries.get(`${id}:${lod}`)!);
    if (bare) expect(bare.width, `${id} ${lod} hair cannot enlarge the bare skull`).toBeLessThanOrEqual(skull.size.z + 1e-6);
    for (const hat of hats) { const size = fitted(id, lod, hat).getSize(new Vector3()), brow = skinnedBrow(geometries.get(`${id}:${lod}`)!); expect(size.z / (brow?.width ?? skull.size.z), `${id} ${lod} ${hat} brim/skull at brow`).toBeLessThanOrEqual(brow ? 1.15 + 1e-6 : limit(hat)); }
  }
  for (const id of l1Pedestrians.models) for (const lod of ['lod0', 'lod1', 'lod2'] as const) {
    const geometry = geometries.get(`${id}:${lod}`)!, skull = bakedSkull(geometry)!, frames = glassesTop(geometry);
    for (const hat of hats) {
      const box = fitted(id, lod, hat), centre = box.getCenter(new Vector3()), label = `${id} ${lod} ${hat}`;
      // Anchored: centred over the skull and resting on its upper half, never hanging over face and shoulders.
      expect(Math.abs(centre.z - skull.centre.z), `${label} centred`).toBeLessThan(.03);
      expect(Math.abs(centre.x - skull.centre.x), `${label} centred`).toBeLessThan(skull.size.x * .3);
      expect(box.min.y, `${label} rests on the head`).toBeGreaterThan(skull.centre.y - skull.size.y * .25);
      const brow = skinnedBrow(geometry), highestBrow = Math.max(...(['lod0', 'lod1', 'lod2'] as const).map(l => skinnedBrow(geometries.get(`${id}:${l}`)!)?.y ?? -Infinity));
      expect(box.min.y, `${label} does not float`).toBeLessThan(brow ? Math.max(highestBrow + .04, (frames ?? -Infinity) + .025) : skull.centre.y + skull.size.y / 2);
      // Head scale: the same skull-relative width as on the reference head (lateral, within 20 %).
      if (brow) expect(box.getSize(new Vector3()).z / brow.width, `${label} bare skull scale`).toBeGreaterThan(.8);
      else {
        expect(box.getSize(new Vector3()).z / skull.size.z / reference.get(hat)!, `${label} scale`).toBeGreaterThan(.8);
        expect(box.getSize(new Vector3()).z / skull.size.z / reference.get(hat)!, `${label} scale`).toBeLessThan(1.2);
      }
      // Spectacles stay on the face below the hat (any LOD that keeps the frames).
      if (spectacled.includes(id) && frames !== null) expect(box.min.y, `${label} above the glasses`).toBeGreaterThanOrEqual(frames + glassesClearance - 1e-6);
    }
  }
  accessories.dispose();
}, 300000);
