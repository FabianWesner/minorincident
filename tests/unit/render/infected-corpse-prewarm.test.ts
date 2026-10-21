import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { BufferGeometry } from 'three/webgpu';
import { AssetRegistry } from '../../../src/assets/registry';
import manifest from '../../../src/assets/manifest.json';
import type { AssetDef } from '../../../src/assets/types';
import { infectedDefinitions } from '../../../src/data/infected';
import { CrowdView } from '../../../src/render/CrowdView';
import { StaticCorpses } from '../../../src/render/characters/StaticCorpses';
import { SimWorld } from '../../../src/sim/world/SimWorld';

for (const scenario of ['blast-stress', 'L4', 'L7']) for (const low of [false, true]) {
  test(`T-E27-14c @E27 @E18 ${scenario} ${low ? 'low' : 'high'} prepares the actual LOD2 infected corpse before play`, async () => {
    const world = new SimWorld(), crowd = new CrowdView(world, low);
    world.scenario = scenario;
    const def = infectedDefinitions.find(definition => definition.id === 'infected.runner')!;
    const load = vi.spyOn(AssetRegistry.prototype, 'loadAsset').mockImplementation(async (id, lod) => {
      const asset = (manifest as AssetDef[]).find(asset => asset.id === id)!;
      const bytes = readFileSync(lod === 'lod0' ? asset.glb! : asset.lods![lod === 'lod2' ? 'lod2' : 'lod1']!);
      const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
      return gltf.scene;
    });
    const corpseLoad = vi.spyOn(AssetRegistry.prototype, 'loadCorpse').mockImplementation(async id => {
      const bytes = readFileSync((manifest as AssetDef[]).find(asset => asset.id === id)!.corpseGlb!);
      return (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
    });
    const prepare = vi.spyOn(StaticCorpses.prototype, 'prepare').mockImplementation(() => {});
    const batches = crowd as unknown as {
      loadBatch(definition: typeof def, lod: 'lod1' | 'lod2'): Promise<void>;
      corpseGeometry: Map<string, BufferGeometry>;
    };
    try {
      if (!low) { await batches.loadBatch(def, 'lod1'); expect(prepare).not.toHaveBeenCalled(); }
      await batches.loadBatch(def, 'lod2');
      expect(prepare).toHaveBeenCalledOnce();
      expect([...batches.corpseGeometry.values()]).toContain(prepare.mock.calls[0][1]);
    } finally { prepare.mockRestore(); corpseLoad.mockRestore(); load.mockRestore(); crowd.dispose(); world.dispose(); }
  });
}
