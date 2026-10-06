import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import manifest from '../../src/assets/manifest.json';
import type { AssetDef } from '../../src/assets/types';
import type { DistrictLayout } from '../../src/levels/districts/types';
import { assetIO } from './io';
import { triangleCount } from './delivery';

export async function deliveryReport(): Promise<unknown> {
  const io = await assetIO();
  const rows = [];
  for (const def of manifest as AssetDef[]) {
    if (!existsSync(`assets/${def.id}/model.glb`)) continue;
    const lod0 = statSync(def.glb).size, triangles = triangleCount(await io.read(def.glb));
    const lods = [];
    for (const [tier, path] of Object.entries(def.lods ?? {})) {
      if (!existsSync(path!)) continue;
      lods.push({ tier, bytes: statSync(path!).size, triangleRatio: triangleCount(await io.read(path!)) / triangles });
    }
    rows.push({ id: def.id, registered: !!def.sourceGlb, bytes: lod0, triangles, lods });
  }
  const layout = JSON.parse(readFileSync('public/assets/layouts/D-RES.layout.json', 'utf8')) as DistrictLayout;
  const plannedPaths = new Set<string>();
  const paths = new Set(['public/assets/layouts/D-RES.base.glb', 'public/assets/layouts/D-RES.layout.json']);
  for (const placement of layout.placements) {
    const def = manifest.find(def => def.id === placement.assetId);
    if (def && existsSync(def.glb)) plannedPaths.add(def.glb);
    if (def && ['integrated', 'final'].includes(def.status)) paths.add(def.glb);
  }
  for (const id of ['char.survivor-male', 'char.survivor-female']) paths.add(manifest.find(def => def.id === id)!.glb);
  for (const path of paths) plannedPaths.add(path);
  const bytes = (directory: string): number => readdirSync(directory, { withFileTypes: true }).reduce((sum, entry) => sum + (entry.isDirectory() ? bytes(`${directory}/${entry.name}`) : statSync(`${directory}/${entry.name}`).size), 0);
  const startDistrictBytes = [...paths].reduce((sum, path) => sum + statSync(path).size, 0);
  return { shippedBytes: bytes('public'), layoutBytes: bytes('public/assets/layouts'), decoderBytes: bytes('public/assets/basis'), plannedStartDistrictBytes: [...plannedPaths].reduce((sum, path) => sum + statSync(path).size, 0), modelBytes: readdirSync('public/assets/models').filter(file => file.endsWith('.glb')).reduce((sum, file) => sum + statSync(`public/assets/models/${file}`).size, 0), startDistrictBytes, startDistrictFiles: [...paths], rows };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync('test-results/assets', { recursive: true });
  const report = await deliveryReport();
  writeFileSync('test-results/assets/delivery.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
