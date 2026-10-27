import { stripGlbTextures } from '../../../tools/assets/stripGlbTextures';
import { readFileSync } from 'node:fs';
import { Box3, Vector3, Mesh, Texture, type MeshStandardMaterial } from 'three';
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
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(stripGlbTextures(bytes), '');
  const def = manifest.find(d => d.glb === path || d.lods?.lod2 === path);
  if (def?.textureMode) {
    const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12))), atlas = new Texture(); atlas.image = { width: 1, height: 1 } as never;
    gltf.scene.userData.assetTextureMode = def.textureMode;
    gltf.scene.traverse(node => { if (node instanceof Mesh) for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      const index = gltf.parser.associations.get(material)?.materials;
      if (index !== undefined && json.materials[index]?.pbrMetallicRoughness?.baseColorTexture) (material as MeshStandardMaterial).map = atlas;
    } });
  }
  return gltf.scene;
}
for (const low of [true, false]) for (const asset of regularInfectedModels) {
  test(`PO #85 @E32 @E07 ${asset} ${low ? 'low' : 'high'} retains the complete corpse surface, weighted skins or closed rigid shells`, async () => {
    const world = new SimWorld(), crowd = new CrowdView(world, low); world.scenario = 'L10';
    const definition = manifest.find(d => d.id === asset)!;
    const skin = 'crowdSkin' in definition && definition.crowdSkin;
    if (!skin) expect(definition.corpseGlb).toBe(`public/assets/models/${asset}.corpse.glb`);
    const corpseModel = await model(definition.corpseGlb ?? definition.lods!.lod2!);
    expect(corpseModel.userData.deliveryLodGenerated).not.toBe(true);
    const load = vi.spyOn(AssetRegistry.prototype, 'loadAsset').mockResolvedValue(await model(definition.lods!.lod2!));
    const loadCorpse = vi.spyOn(AssetRegistry.prototype, 'loadCorpse').mockResolvedValue(corpseModel);
    const prepare = vi.spyOn(StaticCorpses.prototype, 'prepare').mockImplementation(() => {});
    const def = { ...infectedDefinitions.find(d => d.id === 'infected.runner')!, asset };
    try {
      await (crowd as unknown as { loadBatch(definition: typeof def, lod: 'lod2'): Promise<void> }).loadBatch(def, 'lod2');
      expect(prepare).toHaveBeenCalledTimes(3);
      expect(prepare.mock.calls.map(call => call[0])).toEqual(['death-back', 'death-side', 'death-crumple'].map(pose => `infected.runner:${pose}:0`));
      const geometry = prepare.mock.calls[0][1], clip = prepare.mock.calls[0][3];
      expect(geometry.userData).toMatchObject({ crowdLod: 'lod2', corpseSource: definition.corpseGlb ?? definition.lods!.lod2 });
      if (skin) { expect(clip.binds).toBeDefined(); expect(geometry.hasAttribute('_skin')).toBe(true); }
      expect(geometry.index!.count / 3).toBeLessThanOrEqual(2000);
      const positions = geometry.getAttribute('position'), parts = geometry.getAttribute('_parts');
      const index = geometry.index!, bounds = new Map<number, Box3>(), point = new Vector3();
      for (let i = 0; i < index.count; i += 3) {
        const owner = parts.getX(index.getX(i));
        for (let j = 0; j < 3; j++) {
          const vertex = index.getX(i + j);
          if (!skin) expect(parts.getX(vertex)).toBe(owner);
          const part = parts.getX(vertex);
          if (!bounds.has(part)) bounds.set(part, new Box3());
          bounds.get(part)!.expandByPoint(point.fromBufferAttribute(positions, vertex));
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

for(const coat of ['', 'black', 'cream']) test(`PO #93 L10 dog ${coat||'base'} corpse retains the intact source instead of the reduced living mesh`, async()=>{
  const world=new SimWorld(),crowd=new CrowdView(world,true);world.scenario='L10';
  const def={...infectedDefinitions.find(d=>d.id==='infected.dog')!,...(coat?{id:`inf.dog.${coat}`,decay:coat}:{})};
  const asset=manifest.find(d=>d.id==='inf.dog')!;
  const load=vi.spyOn(AssetRegistry.prototype,'loadAsset').mockImplementation(async(_id,lod)=>model(lod==='lod0'?asset.glb:asset.lods!.lod2!));
  const prepare=vi.spyOn(StaticCorpses.prototype,'prepare').mockImplementation(()=>{});
  try{
    await (crowd as unknown as {loadBatch(definition:typeof def,lod:'lod2'):Promise<void>}).loadBatch(def,'lod2');
    expect(load).toHaveBeenCalledWith('inf.dog','lod0',coat||undefined);
    expect(prepare).toHaveBeenCalledTimes(3);
    expect(prepare.mock.calls[0][1].userData.corpseSource).toBe(asset.glb);
    expect(prepare.mock.calls[0][1].index!.count).toBeGreaterThan(3000);
  }finally{load.mockRestore();prepare.mockRestore();crowd.dispose();world.dispose();}
});
