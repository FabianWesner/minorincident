/** Restore the PROD head in the crawler's crouched frame; retain q249 hands. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { getBounds, prune } from '@gltf-transform/functions';
import type { AssetDef } from '../../src/assets/types';
import { assetIO } from '../../tools/assets/io';
import { calibrateFigure, measureFigure } from '../../tools/assets/figure-proportions';
import { prepareHeadProfile } from '../../tools/q249/head-profiles';
import { skinCrowdBakes } from '../../tools/assets/skin-crowd-bakes';

const production = 'fd8f56ca3';
const manifestPath = 'src/assets/manifest.json', bakePath = 'src/assets/civilianBakes.json';
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as AssetDef[];
const def = manifest.find(row => row.id === 'inf.crawler')!;
const io = await assetIO();
const target = measureFigure(await io.read('public/assets/models/char.courier-female.skin.glb')).ratios;
const paths = [def.sourceGlb!, ...[def.glb, ...Object.values(def.lods!)].flatMap(path => [path, path.replace('.glb', '.low.glb')])];
const receipts = [];
for (const path of paths) {
  const original = execFileSync('git', ['show', `${production}:${path}`], { maxBuffer: 64 * 1024 * 1024 });
  const document = await io.readBinary(original);
  const textures = document.getRoot().listTextures().map(texture => createHash('sha256').update(texture.getImage()!).digest('hex'));
  await prepareHeadProfile(document, def.id);
  // Crouched height is not a standing anatomy measurement. Preserve the full
  // production head, including neck and bind pivots, instead of fitting that ratio.
  const receipt = calibrateFigure(document, target, { headScale: 1, handScale: .75 });
  if (JSON.stringify(textures) !== JSON.stringify(document.getRoot().listTextures().map(texture => createHash('sha256').update(texture.getImage()!).digest('hex')))) throw Error('Texture changed');
  await document.transform(prune({ keepLeaves: true, keepAttributes: true }));
  await io.write(path, document);
  receipts.push({ path, ...receipt, texturesUnchanged: true });
}
const document = await io.read(def.glb);
const bounds = getBounds(document.getRoot().listNodes().find(node => node.getName() === 'skin_body')!);
def.dimensions = { ...def.dimensions, x: bounds.max[0] - bounds.min[0], y: bounds.max[1] - bounds.min[1], z: bounds.max[2] - bounds.min[2] };
const bakes = JSON.parse(readFileSync(bakePath, 'utf8')) as Record<string, string>;
Object.assign(bakes, await skinCrowdBakes(def));
const referenced = new Set(Object.values(bakes));
for (const name of readdirSync('public/assets/civilians')) if (name.startsWith('inf.crawler.lod') && !referenced.has('/assets/civilians/' + name)) unlinkSync('public/assets/civilians/' + name);
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(bakePath, JSON.stringify(bakes, null, 2) + '\n');
mkdirSync('docs/reports/q260', { recursive: true });
writeFileSync('docs/reports/q260/geometry.json', JSON.stringify({ production, headScale: 1, handScale: .75, receipts, bakes: Object.fromEntries(Object.entries(bakes).filter(([key]) => key.startsWith('inf.crawler:'))) }, null, 2) + '\n');
console.log('Crawler restored: PROD head, q249 hands, current runtime height rules; all LODs and corpse bakes.');
