import { readFileSync, writeFileSync } from 'node:fs';
import { prune } from '@gltf-transform/functions';
import { assetIO } from './io';
import { geometryHash } from './validate';
import { consolidateMeshopt } from './compress';

// Patch delivered legacy layouts without reauthoring their placement/navigation
// data. The source recipe in sslib/layout.py no longer creates this demo object.
const io = await assetIO();
for (const district of ['D-RES', 'D-SCHOOL', 'D-SHOP', 'D-ZOO']) {
  const path = `public/assets/layouts/${district}.base.glb`;
  const doc = await io.read(path);
  const canopies = doc.getRoot().listNodes().filter(node => node.getName() === 'collapse-canopy');
  if (!canopies.length) throw new Error(`${district}: legacy canopy missing`);
  for (const node of canopies) node.setMesh(null);
  await doc.transform(prune({ keepLeaves: true, keepAttributes: true }));
  writeFileSync(path, await consolidateMeshopt(await io.writeBinary(doc)));
  const layoutPath = `public/assets/layouts/${district}.layout.json`;
  // Preserve the author's number formatting and every unrelated layout field.
  const layout = readFileSync(layoutPath, 'utf8')
    .replace(/"geometryHash": "[a-f0-9]+"/, `"geometryHash": "${geometryHash(doc)}"`);
  writeFileSync(layoutPath, layout);
  console.log(`${district}: removed ${canopies.length} unsupported canopy`);
}
