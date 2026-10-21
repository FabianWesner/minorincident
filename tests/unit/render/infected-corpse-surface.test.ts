import { readFileSync } from 'node:fs';
import { Vector3, type BufferGeometry } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { expect, test, vi } from 'vitest';
import { AssetRegistry } from '../../../src/assets/registry';
import { regularInfectedModels } from '../../../src/data/crowdAppearance';
import { infectedDefinitions } from '../../../src/data/infected';
import { CrowdView } from '../../../src/render/CrowdView';
import { bakeInfected } from '../../../src/render/characters/bakeInfected';
import { StaticCorpses } from '../../../src/render/characters/StaticCorpses';
import { SimWorld } from '../../../src/sim/world/SimWorld';

function areas(geometry: BufferGeometry, channel: string): Map<number, number> {
  const position = geometry.getAttribute('position'), parts = geometry.getAttribute(channel), index = geometry.index;
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), result = new Map<number, number>();
  for (let i = 0; i < (index?.count ?? position.count); i += 3) {
    const x = index?.getX(i) ?? i, y = index?.getX(i + 1) ?? i + 1, z = index?.getX(i + 2) ?? i + 2;
    a.fromBufferAttribute(position, x); b.fromBufferAttribute(position, y).sub(a); c.fromBufferAttribute(position, z).sub(a);
    result.set(parts.getX(x), (result.get(parts.getX(x)) ?? 0) + b.cross(c).length() / 2);
  }
  return result;
}

for (const low of [true, false]) for (const asset of regularInfectedModels) {
  test(`PO #85 @E32 @E07 ${asset} ${low ? 'low' : 'high'} permanent body retains the authored LOD2 surface`, async () => {
    const world = new SimWorld(), crowd = new CrowdView(world, low); world.scenario = 'L10';
    const bytes = readFileSync(`public/assets/models/${asset}.lod2.glb`);
    const model = (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
    const authored = bakeInfected(model.clone(true));
    const load = vi.spyOn(AssetRegistry.prototype, 'loadAsset').mockResolvedValue(model);
    const prepare = vi.spyOn(StaticCorpses.prototype, 'prepare').mockImplementation(() => {});
    const def = { ...infectedDefinitions.find(d => d.id === 'infected.runner')!, asset };
    try {
      await (crowd as unknown as { loadBatch(definition: typeof def, lod: 'lod2'): Promise<void> }).loadBatch(def, 'lod2');
      expect(prepare).toHaveBeenCalledOnce();
      const corpse = prepare.mock.calls[0][1];
      expect(corpse.userData.crowdLod).toBe('lod2');
      const before = areas(authored.geometry, '_part_index'), after = areas(corpse, '_parts');
      for (const [part, surface] of before) if (surface > .0001) {
        expect((after.get(part) ?? 0) / surface, authored.clip.parts[part]).toBeGreaterThanOrEqual(.9799);
      }
      expect(corpse.index!.count).toBeLessThan(authored.geometry.getAttribute('position').count);
    } finally { load.mockRestore(); prepare.mockRestore(); authored.geometry.dispose(); crowd.dispose(); world.dispose(); }
  });
}
