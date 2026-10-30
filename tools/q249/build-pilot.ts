/** PO review gate: recalibrate only the blue-shirt man. Existing production
 * highs/LODs are the inputs; dedicated outputs leave every alias untouched. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { getBounds, prune } from '@gltf-transform/functions';
import { assetIO } from '../assets/io';
import { calibrateFigure, measureFigure } from '../assets/figure-proportions';
import { skinCrowdBakes } from '../assets/skin-crowd-bakes';
import type { AssetDef } from '../../src/assets/types';
const baseline = '4698e5aa0', id = 'npc.civilian-man-a';
const original = (path: string) => execFileSync('git', ['show', `${baseline}:${path}`], { maxBuffer: 64 * 1024 * 1024 });
const io = await assetIO();
const sourceManifest = JSON.parse(original('src/assets/manifest.json').toString()) as AssetDef[];
const def = structuredClone(sourceManifest.find(d => d.id === id)!);
const heroinePath = 'public/assets/models/char.courier-female.skin.glb', heroine = readFileSync(heroinePath);
if (!heroine.equals(original(heroinePath))) throw Error('Approved heroine changed');
const target = measureFigure(await io.read(heroinePath)).ratios, rows = [];
mkdirSync('public/assets/models/q249-pilot', { recursive: true });
mkdirSync('docs/reports/q249/pilot-2', { recursive: true });
for (const [input, output] of [
  [def.sourceGlb!, 'assets/npc.civilian-man-a/model.q249.skin.glb'],
  ...[def.glb, ...Object.values(def.lods!)].flatMap(input => [false, true].map(low => [input.replace('.glb', low ? '.low.glb' : '.glb'), input.replace('models/skinned/', 'models/q249-pilot/').replace('.glb', low ? '.low.glb' : '.glb')])),
]) {
  const bytes = original(input), document = await io.readBinary(bytes);
  const receipt = calibrateFigure(document, target);
  for (const key of ['headHeight','headShoulder','legHeight'] as const) {
    if (Math.abs(receipt.after[key] / target[key] - 1) > .1) throw Error(`${output}: ${key} outside tolerance`);
  }
  if (Math.abs(receipt.shoulderWidthAfter-receipt.shoulderWidthBefore)>1e-6) throw Error('Shoulder width changed');
  await document.transform(prune({ keepLeaves: true, keepAttributes: true })); await io.write(output, document);
  if (input === def.glb) { const b = getBounds(document.getRoot().listNodes().find(n => n.getName() === 'skin_body')!); def.dimensions = { x:b.max[0]-b.min[0], y:b.max[1]-b.min[1], z:b.max[2]-b.min[2], tolerance:.15 }; }
  rows.push({ input, output, sourceSha256:createHash('sha256').update(bytes).digest('hex'), ...receipt });
}
def.sourceGlb = 'assets/npc.civilian-man-a/model.q249.skin.glb';
def.glb = def.glb.replace('models/skinned/', 'models/q249-pilot/');
def.lods = Object.fromEntries(Object.entries(def.lods!).map(([k,v]) => [k,v.replace('models/skinned/', 'models/q249-pilot/')])) as AssetDef['lods'];
const manifest = JSON.parse(readFileSync('src/assets/manifest.json','utf8')) as AssetDef[];
writeFileSync('src/assets/manifest.json', JSON.stringify(manifest.map(d => d.id === id ? def : d), null, 2)+'\n');
const bakes = JSON.parse(readFileSync('src/assets/civilianBakes.json','utf8')) as Record<string,string>;
Object.assign(bakes, await skinCrowdBakes(def));
writeFileSync('src/assets/civilianBakes.json',JSON.stringify(bakes,null,2)+'\n');
writeFileSync('docs/reports/q249/pilot-2/ratios.json',JSON.stringify({ baseline, heroine:{ path:heroinePath, sha256:createHash('sha256').update(heroine).digest('hex'), target }, rows },null,2)+'\n');
console.log('Pilot only: high source, all 3 LODs × high/low, healthy/infected/corpse bakes.');
