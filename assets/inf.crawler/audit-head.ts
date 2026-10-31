import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import type { AssetDef } from '../../src/assets/types';
import { assetIO } from '../../tools/assets/io';
import { measureFigure } from '../../tools/assets/figure-proportions';
import { prepareHeadProfile } from '../../tools/q249/head-profiles';

const io = await assetIO(), main = 'c7e1c130c', production = 'fd8f56ca3';
const old = (revision: string, path: string) => execFileSync('git', ['show', `${revision}:${path}`], { maxBuffer: 64 * 1024 * 1024 });
const manifest = JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as AssetDef[];
const originalManifest = JSON.parse(old(main, 'src/assets/manifest.json').toString()) as AssetDef[];
const def = manifest.find(row => row.id === 'inf.crawler')!;
const paths = [def.sourceGlb!, ...[def.glb, ...Object.values(def.lods!)].flatMap(path => [path, path.replace('.glb', '.low.glb')])];
const rows = [], errors: string[] = [];
for (const path of paths) {
  const [prod, before, after] = await Promise.all([io.readBinary(old(production, path)), io.readBinary(old(main, path)), io.read(path)]);
  await prepareHeadProfile(prod, def.id);
  let headVertices = 0, handVertices = 0, maxHeadError = 0, maxHandError = 0;
  for (const node of prod.getRoot().listNodes()) {
    const a = after.getRoot().listNodes().find(row => row.getName() === node.getName());
    const b = before.getRoot().listNodes().find(row => row.getName() === node.getName());
    if (!a?.getMesh() || !b?.getMesh()) continue;
    node.getMesh()?.listPrimitives().forEach((primitive, index) => {
      const source = primitive.getAttribute('POSITION')!, target = a.getMesh()!.listPrimitives()[index].getAttribute('POSITION')!, previous = b.getMesh()!.listPrimitives()[index].getAttribute('POSITION')!;
      const joints = primitive.getAttribute('JOINTS_0'), weights = primitive.getAttribute('WEIGHTS_0');
      if (source.getCount() !== target.getCount() || source.getCount() !== previous.getCount()) throw Error(`${path}: vertex correspondence lost`);
      for (let i = 0; i < source.getCount(); i++) {
        const s = source.getElement(i, []), t = target.getElement(i, []), p = previous.getElement(i, []);
        if (primitive.getAttribute('_Q249_HEAD')?.getScalar(i)) { headVertices++; maxHeadError = Math.max(maxHeadError, Math.hypot(...s.map((v, k) => v - t[k]))); }
        if (joints && weights && node.getSkin()) {
          const names = joints.getElement(i, []).map(j => node.getSkin()!.listJoints()[j].getName());
          const influence = weights.getElement(i, []).reduce((sum, w, k) => sum + (/^hand[LR]$/.test(names[k]) ? w : 0), 0);
          if (influence > .99) { handVertices++; maxHandError = Math.max(maxHandError, Math.hypot(...p.map((v, k) => v - t[k]))); }
        }
      }
    });
  }
  const imageHashes = (document: typeof prod) => document.getRoot().listTextures().map(texture => createHash('sha256').update(texture.getImage()!).digest('hex'));
  const texturesUnchanged = JSON.stringify(imageHashes(before)) === JSON.stringify(imageHashes(after));
  if (!headVertices || !handVertices || maxHeadError > 1e-6 || maxHandError > 1e-6 || !texturesUnchanged) errors.push(path);
  rows.push({ path, headVertices, handVertices, maxHeadErrorM: maxHeadError, maxHandErrorM: maxHandError, texturesUnchanged, before: measureFigure(before), after: measureFigure(after), prod: measureFigure(prod) });
}
for (const entry of manifest) if (entry.id !== 'inf.crawler' && JSON.stringify(entry) !== JSON.stringify(originalManifest.find(row => row.id === entry.id))) errors.push(`${entry.id}: manifest changed`);
const originalBakes = JSON.parse(old(main, 'src/assets/civilianBakes.json').toString()) as Record<string, string>;
const currentBakes = JSON.parse(readFileSync('src/assets/civilianBakes.json', 'utf8')) as Record<string, string>;
for (const key of Object.keys(originalBakes)) if (!key.startsWith('inf.crawler:') && originalBakes[key] !== currentBakes[key]) errors.push(`${key}: bake changed`);
const delivered = execFileSync('git', ['diff', '--name-only', main, '--', 'public/assets']).toString().trim().split('\n').filter(Boolean);
if (delivered.some(path => !path.includes('/inf.crawler.'))) errors.push('Another delivered figure changed');
writeFileSync('docs/reports/q260/audit.json', JSON.stringify({ main, production, errors, delivered, rows }, null, 2) + '\n');
console.log(`${rows.length} crawler meshes: PROD head retained, main hands retained, textures unchanged; ${errors.length} errors`);
if (errors.length) { console.error(errors); process.exitCode = 1; }
