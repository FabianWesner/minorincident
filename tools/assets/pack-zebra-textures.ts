/** Pack reviewed high/low texture siblings without rebuilding or changing their rig. */
import { readFileSync, writeFileSync } from 'node:fs';
import { assetIO } from './io';
import { geometryHash, validateDocument } from './validate';
import manifest from '../../src/assets/manifest.json';
import type { AssetDef } from '../../src/assets/types';
import { optimizeAsset } from './optimize';
import { packAsset } from './pack';
for (const id of ['amb.zebra', 'inf.zebra']) {
  const def = manifest.find(a => a.id === id)! as AssetDef;
  await packAsset(def);
  const io = await assetIO(), source = await io.read(def.sourceGlb!), runtime = await io.read(def.glb);
  const meta = validateDocument(source, def, readFileSync(def.sourceGlb!).length);
  // Standard delivery repairs zero-area exporter faces, as buildAsset does.
  const repairedSourceErrors = meta.errors.filter(e => e.includes('degenerate triangle'));
  meta.errors = meta.errors.filter(e => !e.includes('degenerate triangle'));
  const delivered = validateDocument(runtime, def, readFileSync(def.glb).length, 0, source);
  if (meta.errors.length || delivered.errors.length) throw new Error([...meta.errors, ...delivered.errors].join('; '));
  writeFileSync(def.glb.replace('.glb', '.meta.json'), JSON.stringify({ ...meta, repairedSourceErrors, hash: geometryHash(source), runtime: delivered, nodes: source.getRoot().listNodes().map(n => ({ name: n.getName(), pivot: n.getWorldTranslation() })) }, null, 2) + '\n');
  for (const lod of ['', '.lod1', '.lod2']) await optimizeAsset(`assets/${id}/model${lod}.low.glb`, `public/assets/models/${id}${lod}.low.glb`, def);
}
