import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { BufferGeometry } from 'three/webgpu';
import manifest from '../../../src/assets/manifest.json';
import type { AssetDef } from '../../../src/assets/types';
import { AssetRegistry } from '../../../src/assets/registry';
import { infectedDefinitions } from '../../../src/data/infected';
import { alphaLookAssets } from '../../../src/data/alphaLooks';
import { loadGate } from '../../../src/assets/loadGate';
import { CrowdView } from '../../../src/render/CrowdView';
import { StaticCorpses } from '../../../src/render/characters/StaticCorpses';
import { SimWorld } from '../../../src/sim/world/SimWorld';

for (const asset of alphaLookAssets) for (const low of [false, true]) test(`PO #21/#93 @E18 ${asset} corpse retains its whole authored body (${low ? 'low' : 'high'})`, async () => {
  const world = new SimWorld(), crowd = new CrowdView(world, low);
  const definition = { ...infectedDefinitions.find(d => d.asset === 'inf.alpha')!, id: asset, asset };
  const load = vi.spyOn(AssetRegistry.prototype, 'loadAsset').mockImplementation(async (id, lod) => {
    const asset = (manifest as AssetDef[]).find(a => a.id === id)!;
    const bytes = readFileSync(lod === 'lod0' ? asset.glb! : asset.lods![lod === 'lod2' ? 'lod2' : 'lod1']!);
    return (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
  });
  const prepare = vi.spyOn(StaticCorpses.prototype, 'prepare').mockImplementation(() => {});
  const view = crowd as unknown as { loadBatch(d: typeof definition, lod: 'lod0' | 'lod2'): Promise<void>; corpseGeometry: Map<string, BufferGeometry>; batches: Map<string, { mesh: { geometry: BufferGeometry } }> };
  try {
    // A distant death can settle before any living hero batch is requested.
    await view.loadBatch(definition, 'lod2');
    const frozen = [...view.corpseGeometry.values()][0];
    expect(frozen).toBeDefined(); expect(frozen.index!.count).toBeGreaterThan(5000);
    expect(frozen.hasAttribute('_parts')).toBe(true);
    expect(prepare).toHaveBeenCalledWith(expect.any(String), frozen, expect.anything(), expect.anything(), expect.any(Number));
    await view.loadBatch(definition, 'lod0');
    const source=[...view.batches.entries()].find(([key])=>key.endsWith(':lod0'))![1].mesh.geometry;
    expect(frozen.index!.count).toBe(source.index!.count);
    expect([...view.corpseGeometry.values()][0]).toBe(frozen);
    // Unload while the batch waits for its loading-gate slot: the one suspension point every load takes, including a
    // cross-level cache hit that skips the bake and the LOD simplification.
    const gate = vi.spyOn(loadGate, 'wait').mockImplementation(async () => { crowd.dispose(); });
    try {
      await view.loadBatch(definition, 'lod2');
      expect(view.batches.size, 'an unloaded Alpha must never acquire a late mesh/atlas').toBe(0);
    } finally { gate.mockRestore(); }
  } finally { prepare.mockRestore(); load.mockRestore(); crowd.dispose(); world.dispose(); }
});
