import manifest from '../../src/assets/manifest.json';
import { variantPath, type AssetDef } from '../../src/assets/types';
import { validateAssets } from './validate';
import { packAsset } from './pack';
import { assetIO } from './io';
import { triangleCount } from './delivery';
import { mkdirSync, writeFileSync } from 'node:fs';
const reportIndex = process.argv.indexOf('--report');
const report = reportIndex < 0 ? 'docs/reports/eg-l10-farm' : process.argv[reportIndex + 1];
if (!report) throw Error('--report requires a directory');
mkdirSync(report, { recursive: true });
const rows: { id: string; lod: string; triangles: number }[] = [];
for (const def of manifest as AssetDef[]) {
  if (!['veg.corn-block', 'prop.farm-scarecrow', 'prop.farm-carcass', 'prop.tree.dead', 'bld.farm-barn-ruin', 'bld.farm-house-ruin', 'prop.farm-tractor', 'prop.farm-combine', 'prop.farm-irrigator'].includes(def.id)) continue;
  await packAsset(def);
  const io = await assetIO();
  for (const decay of [undefined, ...def.decayVariants]) for (const [lod, file] of Object.entries({ lod0: def.glb, ...def.lods })) rows.push({ id: def.id + (decay ? `.${decay}` : ''), lod, triangles: triangleCount(await io.read(variantPath(file!, decay))) });
}
writeFileSync(`${report}/runtime-budgets.json`, JSON.stringify(rows, null, 2) + '\n');
const selected = (manifest as AssetDef[]).filter(def => def.script === 'tools/blender/build_l10_farm.py');
const validation = await validateAssets(selected);
writeFileSync(`${report}/asset-validation.json`, JSON.stringify(validation, null, 2) + '\n');
const errors = validation.flatMap(row => row.errors.map(error => `${row.id}: ${error}`));
if (errors.length) throw Error(errors.join('\n'));
console.log(`Packed ${rows.length} farm asset tiers`);
