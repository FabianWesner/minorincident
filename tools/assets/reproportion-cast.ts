/** Recalibrate existing production highs and every delivered LOD, then use the
 * regular crowd bake. No inference, surface reconstruction or runtime work.
 * Inputs are snapshotted once so repeated runs use the same before geometry.
 * node --import tsx tools/assets/reproportion-cast.ts [id ...] */
import { copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { getBounds, prune } from '@gltf-transform/functions';
import { assetIO } from './io';
import { calibrateFigure, measureFigure } from './figure-proportions';
import { skinCrowdBakes } from './skin-crowd-bakes';
import type { AssetDef } from '../../src/assets/types';

const io = await assetIO(), base = 'test-results/q249/before', out = 'docs/reports/q249';
mkdirSync(out, { recursive: true });
const snapshot = (path: string) => {
  const saved = join(base, path);
  if (!existsSync(saved)) { mkdirSync(dirname(saved), { recursive: true }); copyFileSync(path, saved); }
  return saved;
};
const heroinePath = 'public/assets/models/char.courier-female.skin.glb';
const target = measureFigure(await io.read(heroinePath)).ratios;
const manifestPath = 'src/assets/manifest.json', bakesPath = 'src/assets/civilianBakes.json';
snapshot(manifestPath); snapshot(bakesPath);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as AssetDef[];
const bakes = JSON.parse(readFileSync(bakesPath, 'utf8')) as Record<string, string>;
const reportPath = join(out, 'ratios.json');
const report: Record<string, unknown> = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : {};
const selected = process.argv.slice(2);
for (const def of manifest.filter(d => /^(npc\.|inf\.|char\.)/.test(d.id) && !/dog|cat-|corgi|crow$|lion|gorilla|elephant|flamingo|zebra|courier-female|civilian-kid|npc.brother/.test(d.id) && (!selected.length || selected.includes(d.id)))) {
  const paths = [...new Set([def.sourceGlb, def.glb, ...Object.values(def.lods ?? {}), ...[def.glb, ...Object.values(def.lods ?? {})].map(p => p.replace('.glb', '.low.glb')), ...(def.id === 'char.courier-male' ? [def.glb.replace('.glb', '.skin.glb'), def.glb.replace('.glb', '.skin.low.glb')] : [])])].filter((p): p is string => !!p && existsSync(p));
  const receipts = [];
  for (const path of paths) {
    const input = snapshot(path), document = await io.read(input);
    const roots = def.id === 'npc.survivor-group' ? ['survivor01_root', 'survivor02_root', 'survivor03_root', 'survivor04_root'] : [undefined];
    const measurements = roots.map(root => ({ root, ...calibrateFigure(document, target, root) }));
    for (const row of measurements) for (const key of ['headHeight', 'headShoulder', 'legHeight'] as const) {
      if (Math.abs(row.after[key] / target[key] - 1) > .1) throw Error(`${def.id} ${path}: ${key} outside heroine tolerance: ${row.after[key]}`);
    }
    await document.transform(prune({ keepLeaves: true, keepAttributes: true }));
    await io.write(path, document);
    receipts.push({ path, sourceSha256: createHash('sha256').update(readFileSync(input)).digest('hex'), ...measurements[0], figures: measurements });
    if (path === def.glb) {
      const bounds = getBounds(document.getRoot().listNodes().find(n => n.getName() === 'skin_body') ?? document.getRoot().listScenes()[0]);
      def.dimensions = { x: bounds.max[0] - bounds.min[0], y: bounds.max[1] - bounds.min[1], z: bounds.max[2] - bounds.min[2], tolerance: def.dimensions.tolerance };
    }
  }
  if (def.crowdSkin) {
    const replacement = await skinCrowdBakes(def);
    for (const key of Object.keys(bakes)) if (key.startsWith(def.id + ':')) {
      const path = 'public' + bakes[key]; delete bakes[key];
      if (existsSync(path) && !Object.values(replacement).includes(path.slice(6))) { snapshot(path); unlinkSync(path); }
    }
    Object.assign(bakes, replacement);
  }
  report[def.id] = receipts;
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  writeFileSync(bakesPath, JSON.stringify(bakes, null, 2) + '\n');
  console.log(`${def.id}: calibrated ${paths.length} source/LOD/tier files`);
}
writeFileSync(join(out, 'heroine.json'), JSON.stringify({ path: heroinePath, sha256: createHash('sha256').update(readFileSync(heroinePath)).digest('hex'), target }, null, 2) + '\n');
