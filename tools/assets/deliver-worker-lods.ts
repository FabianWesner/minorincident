/** Deliver the closed-solid tiers from rebuild-worker-lods.py without a second
 * collapse pass. Both tiers must validate before replacing runtime assets. */
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import manifest from '../../src/assets/manifest.json';
import type { AssetDef } from '../../src/assets/types';
import { assetIO } from './io';
import { generateStumpCaps, normalizeForward, normalizeScale, optimizeAsset } from './optimize';
import { validateDocument } from './validate';

const def = manifest.find(a => a.id === 'inf.common-worker') as AssetDef;
const io = await assetIO(), results = [];
for (const [index, lod] of (['lod1', 'lod2'] as const).entries()) {
  const source = `.cache/crowd-feel/model.${lod}.glb`, stage = `.cache/crowd-feel/delivered.${lod}.glb`;
  const document = await io.read(source);
  normalizeForward(document, def); normalizeScale(document, def); generateStumpCaps(document, def);
  await io.write(source, document);
  await optimizeAsset(source, stage, def);
  const validation = validateDocument(await io.read(stage), def, readFileSync(stage).length, index + 1);
  if (validation.errors.length) throw new Error(`${lod}: ${validation.errors.join('; ')}`);
  results.push({ lod, source, stage, validation });
}
for (const { lod, source, stage } of results) {
  copyFileSync(source, `assets/inf.common-worker/model.${lod}.glb`);
  copyFileSync(stage, def.lods![lod]!);
}
writeFileSync('test-results/epics/E07/crowd-feel/worker-delivery.json', JSON.stringify(results.map(({ lod, validation }) => ({ lod, ...validation })), null, 2));
console.log(results.map(({ lod, validation }) => ({ lod, ...validation })));
