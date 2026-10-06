import { expect, test } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicNodeMaterial } from 'three/webgpu';
import { AssetRegistry, lodForScreenHeight, type PlaceholderLog } from '../../../src/assets/registry';
import { fixture } from './fixture';
import { placeholder } from '../../../src/assets/placeholders';

test('T-E17-05 @E17-AC05 missing GLB and pre-integrated art fall back with logs and contract nodes', async () => {
  const { def } = fixture(); def.status = 'integrated';
  const logs: PlaceholderLog[] = [];
  let requests = 0;
  const registry = new AssetRegistry((e) => logs.push(e), { manifest: [def], load: async () => { requests++; throw new Error('404'); } });
  const [a,b] = await Promise.all([registry.loadAsset(def.id), registry.loadAsset(def.id)]);
  expect(a.userData.placeholder).toBe(true); expect(a).not.toBe(b); expect(requests).toBe(1);
  expect(logs).toEqual([{ type: 'asset.placeholder', id: def.id, reason: 'Error: 404' }]);
  for (const name of [...def.requiredNodes, ...def.animatedNodes, ...def.sockets]) expect(a.getObjectByName(name), name).toBeDefined();
  await registry.dispose();
  def.status = 'modeled';
  const blocked = new AssetRegistry((e) => logs.push(e), { manifest: [def], load: async () => { throw new Error('should never load'); } });
  expect((await blocked.loadAsset(def.id)).userData.placeholder).toBe(true);
  expect(logs.at(-1)?.reason).toBe('status modeled');
  await blocked.dispose();
});
test('T-E17-05b @E17-AC05 prototypes are independently cloned and every LOD uses its declared path', async () => {
  const { def } = fixture(); def.status = 'integrated'; def.lods = { lod1: 'public/test.lod1.glb', lod2: 'public/test.lod2.glb' };
  def.decayVariants = ['burned'];
  const urls: string[] = [];
  const registry = new AssetRegistry(() => {}, { manifest: [def], load: async (url) => {
    urls.push(url); const root = new Group();
    root.add(new Mesh(new BoxGeometry(def.dimensions.x, def.dimensions.y, def.dimensions.z), new MeshBasicNodeMaterial()));
    for (const name of [...def.requiredNodes, ...def.sockets]) { const node = new Group(); node.name = name; root.add(node); }
    return root;
  } });
  const a = await registry.loadAsset(def.id); a.position.x = 100;
  expect((await registry.loadAsset(def.id)).position.x).toBe(0);
  await registry.loadAsset(def.id, 'low'); await registry.loadAsset(def.id, 'lod2');
  expect(urls).toEqual(['/test.glb', '/test.lod1.glb', '/test.lod2.glb']);
  await registry.loadAsset(def.id,'lod1','burned');
  expect(urls.at(-1)).toBe('/test.burned.lod1.glb');
  await expect(registry.loadAsset(def.id,'high','unknown')).rejects.toThrow('Unknown decay variant');
  expect([lodForScreenHeight(200),lodForScreenHeight(80),lodForScreenHeight(20)]).toEqual(['lod0','lod1','lod2']);
  await registry.dispose();
});
test('T-E17-11 @E17-AC11 placeholder infected caps are hidden and can cover detached limbs', () => {
  const { def } = fixture(); def.category = 'infected';
  def.requiredNodes.push('armL', 'stump_armL');
  const root = placeholder(def), cap = root.getObjectByName('stump_armL')!;
  expect(cap.visible).toBe(false); expect(cap.children).toHaveLength(1);
  root.getObjectByName('armL')!.visible = false; cap.visible = true;
  expect(cap.visible).toBe(true);
});
