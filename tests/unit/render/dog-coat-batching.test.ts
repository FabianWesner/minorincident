/** Diagnose whether palette variants can share one animated geometry without changing surfaces. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { test, vi, expect } from 'vitest';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { BufferGeometry } from 'three/webgpu';
import { AssetRegistry } from '../../../src/assets/registry';
import manifest from '../../../src/assets/manifest.json';
import { variantPath, type AssetDef } from '../../../src/assets/types';
import { infectedDefinitions } from '../../../src/data/infected';
import { shareDogCoatPalette } from '../../../src/render/characters/shareDogCoatPalette';
import { CrowdView } from '../../../src/render/CrowdView';
import { SimWorld } from '../../../src/sim/world/SimWorld';
test('T-E07-12-dog-coats @E07 identical authored LOD1 coat surfaces share a palette while incompatible LOD2 is rejected', async () => {
  const world = new SimWorld(), crowd = new CrowdView(world), def = infectedDefinitions.find(d => d.id === 'infected.dog')!;
  world.scenario = 'horde-arena';
  async function load(id: string, lod: string, decay?: string, corpse = false) {
    const a = (manifest as AssetDef[]).find(a => a.id === id)!;
    const path = corpse ? a.corpseGlb! : lod === 'lod0' ? a.glb! : a.lods![lod as 'lod1' | 'lod2']!;
    const bytes = readFileSync(variantPath(path, decay));
    return (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
  }
  const asset = vi.spyOn(AssetRegistry.prototype, 'loadAsset').mockImplementation((id, lod = 'lod0', decay) => load(id, lod, decay));
  const corpse = vi.spyOn(AssetRegistry.prototype, 'loadCorpse').mockImplementation((id, decay) => load(id, 'lod0', decay, true));
  const internal = crowd as unknown as { loadBatch(d: typeof def & { decay?: string }, lod: 'lod0' | 'lod1' | 'lod2'): Promise<void>; batches: Map<string, {mesh: {geometry: BufferGeometry};poses:{clip:import('../../../src/assets/crowd').CrowdClip}}>; corpseGeometry: Map<string, BufferGeometry> };
  const records: unknown[] = [];
  function compare(a: BufferGeometry, b: BufferGeometry) {
    const triangles = (g: BufferGeometry) => { const ix = g.getIndex()!; const out: string[] = []; for (let i=0;i<ix.count;i+=3) { const a=ix.getX(i),b=ix.getX(i+1),c=ix.getX(i+2); out.push([`${a},${b},${c}`,`${b},${c},${a}`,`${c},${a},${b}`].sort()[0]); } return out.sort().join(';'); };
    const fields = Object.fromEntries(['position', 'normal', '_parts', 'color', 'index'].map(name => {
      const aa = name === 'index' ? a.getIndex()! : a.getAttribute(name), bb = name === 'index' ? b.getIndex()! : b.getAttribute(name);
      return [name, { a: aa.count, b: bb.count, equal: aa.count === bb.count && Array.from(aa.array).every((v, i) => v === bb.array[i]) }];
    }));
    return { ...fields, triangleSetEqual: triangles(a) === triangles(b) };
  }
  try {
    for (const lod of ['lod0','lod1','lod2'] as const) {
      for (const coat of ['', 'black', 'cream']) await internal.loadBatch({ ...def, id: coat ? `inf.dog.${coat}` : def.id, ...(coat ? { decay: coat } : {}) }, lod);
      const batches = [...internal.batches.values()].slice(-3);
      if (lod === 'lod1') {
        expect(shareDogCoatPalette(batches[0].mesh.geometry, batches[2].mesh.geometry, batches[0].poses.clip, batches[2].poses.clip)).toBe(true);
        expect(Array.from(batches[0].mesh.geometry.getAttribute('_dogCream').array)).toEqual(Array.from(batches[2].mesh.geometry.getAttribute('color').array));
      }
      if (lod === 'lod2') expect(shareDogCoatPalette(batches[0].mesh.geometry, batches[2].mesh.geometry, batches[0].poses.clip, batches[2].poses.clip)).toBe(false);
      records.push({ lod, black: compare(batches[0].mesh.geometry,batches[1].mesh.geometry), cream: compare(batches[0].mesh.geometry,batches[2].mesh.geometry), clipsEqual: JSON.stringify(batches[0].poses.clip) === JSON.stringify(batches[1].poses.clip) && JSON.stringify(batches[0].poses.clip) === JSON.stringify(batches[2].poses.clip) });
    }
    const bodies = [...internal.corpseGeometry.values()]; records.push({ corpseBlack: compare(bodies[0],bodies[1]), corpseCream:compare(bodies[0],bodies[2]) });
    mkdirSync('test-results/ac-close-shared',{recursive:true});writeFileSync('test-results/ac-close-shared/dog-coat-geometry.json',JSON.stringify(records,null,2)+'\n');expect(records).toHaveLength(4);
  } finally { asset.mockRestore();corpse.mockRestore();crowd.dispose();world.dispose(); }
});
