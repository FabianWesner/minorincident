import { readFileSync } from 'node:fs';
import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { expect, test, vi } from 'vitest';
import { AssetRegistry } from '../../../src/assets/registry';
import manifest from '../../../src/assets/manifest.json';
import { regularInfectedModels } from '../../../src/data/crowdAppearance';
import { infectedDefinitions } from '../../../src/data/infected';
import { CrowdView } from '../../../src/render/CrowdView';
import { StaticCorpses } from '../../../src/render/characters/StaticCorpses';
import { SimWorld } from '../../../src/sim/world/SimWorld';

async function model(path: string) {
  const bytes = readFileSync(path);
  return (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
}
for (const low of [true, false]) for (const asset of regularInfectedModels) {
  test(`PO #85 @E32 @E07 ${asset} ${low ? 'low' : 'high'} chooses a closed corpse mesh instead of the living LOD`, async () => {
    const world = new SimWorld(), crowd = new CrowdView(world, low); world.scenario = 'L10';
    const definition = manifest.find(d => d.id === asset)!;
    expect(definition.corpseGlb).toBe(`public/assets/models/${asset}.corpse.glb`);
    const corpseModel = await model(definition.corpseGlb!);
    expect(corpseModel.userData.deliveryLodGenerated).not.toBe(true);
    const load = vi.spyOn(AssetRegistry.prototype, 'loadAsset').mockResolvedValue(await model(definition.lods!.lod2!));
    const loadCorpse = vi.spyOn(AssetRegistry.prototype, 'loadCorpse').mockResolvedValue(corpseModel);
    const prepare = vi.spyOn(StaticCorpses.prototype, 'prepare').mockImplementation(() => {});
    const def = { ...infectedDefinitions.find(d => d.id === 'infected.runner')!, asset };
    try {
      await (crowd as unknown as { loadBatch(definition: typeof def, lod: 'lod2'): Promise<void> }).loadBatch(def, 'lod2');
      expect(prepare).toHaveBeenCalledOnce();
      const geometry = prepare.mock.calls[0][1], clip = prepare.mock.calls[0][3];
      expect(geometry.userData).toMatchObject({ crowdLod: 'lod2', corpseSource: definition.corpseGlb });
      expect(geometry.index!.count / 3).toBeLessThanOrEqual(1100);
      const positions = geometry.getAttribute('position'), parts = geometry.getAttribute('_parts');
      const index = geometry.index!, bounds = new Map<number, Box3>(), point = new Vector3();
      for (let i = 0; i < index.count; i += 3) {
        const owner = parts.getX(index.getX(i));
        for (let j = 0; j < 3; j++) {
          const vertex = index.getX(i + j);
          expect(parts.getX(vertex)).toBe(owner);
          if (!bounds.has(owner)) bounds.set(owner, new Box3());
          bounds.get(owner)!.expandByPoint(point.fromBufferAttribute(positions, vertex));
        }
      }
      // Every major anatomical part survives the offline reduction. This catches
      // an accidentally empty/sparse corpse derivative as well as the LOD choice.
      for (const name of ['head', 'torso', 'armL', 'armR', 'legL', 'legR']) {
        const box = bounds.get(clip.parts.indexOf(name));
        expect(box, name).toBeDefined();
        expect(box!.getSize(point).length(), name).toBeGreaterThan(.08);
      }
    } finally { load.mockRestore(); loadCorpse.mockRestore(); prepare.mockRestore(); crowd.dispose(); world.dispose(); }
  });
}
