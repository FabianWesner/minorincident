import { expect, test } from 'vitest';
import manifest from '../../../src/assets/manifest.json';
import { assetIO } from '../../../tools/assets/io';

test('packed checkpoint keeps visible boom meshes under its animated hinge in every LOD', async () => {
  const def = manifest.find(a => a.id === 'kit.army-checkpoint')!;
  expect(def.animatedNodes).toContain('gateArm');
  const io = await assetIO();
  for (const path of [def.glb, def.lods!.lod1!, def.lods!.lod2!]) {
    const document = await io.read(path);
    const hinge = document.getRoot().listNodes().find(node => node.getName() === 'gateArm');
    expect(hinge, path).toBeDefined();
    let meshes = 0;
    hinge!.traverse(node => { if (node.getMesh()) meshes++; });
    expect(meshes, path).toBeGreaterThan(0);
  }
});
