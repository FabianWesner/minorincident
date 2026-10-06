import { expect, test } from 'vitest';
import { Group } from 'three/webgpu';
import { AssetRegistry } from '../../../src/assets/registry';
import { fixture } from '../assets/fixture';
test('E18 @E18 mobile GLB selection prefers declared .low export, preserves lod1 and releases its cache', async () => {
  const { def } = fixture(); def.status = 'integrated'; def.lowGlb = 'public/test.low.glb'; def.lods = { lod1: 'public/test.lod1.glb' };
  const urls: string[] = [];
  const registry = new AssetRegistry(() => {}, { manifest: [def], load: async url => {
    urls.push(url); const root = new Group(); for (const name of [...def.requiredNodes, ...def.sockets]) { const node = new Group(); node.name = name; root.add(node); } return root;
  } });
  await registry.loadAsset(def.id, 'low'); await registry.loadAsset(def.id, 'lod1'); await registry.loadAsset(def.id, 'high');
  expect(urls).toEqual(['/test.low.glb', '/test.lod1.glb', '/test.glb']); await registry.dispose();
});
