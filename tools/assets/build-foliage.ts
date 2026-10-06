import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import manifest from '../../src/assets/manifest.json';
import type { AssetDef } from '../../src/assets/types';
import { optimizeAsset } from './optimize';
import { assetIO } from './io';
import { validateDocument } from './validate';
// Shared reference runner is deliberately outside the worktree; no reference scripts are edited.
const commonGit = execFileSync('git', ['rev-parse', '--git-common-dir'], { encoding: 'utf8' }).trim();
const runner = process.env.FOLIAGE_BLENDER_RUNNER ?? resolve(commonGit, '../experiment/tools/blender_run.py');
for (const def of (manifest as AssetDef[]).filter(a => a.foliage && a.id !== 'prop.tree')) {
  const result = spawnSync('python3', [runner, 'r1-foliage', def.script!, '--', '--glb', def.sourceGlb!, '--lod1', `assets/${def.id}/model.lod1.glb`, '--lod2', `assets/${def.id}/model.lod2.glb`], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Foliage build failed: ${def.id}`);
  const validations = [];
  for (const [lod, path] of [[0, def.glb], [1, def.lods!.lod1!], [2, def.lods!.lod2!]] as const) {
    const source = lod === 0 ? def.sourceGlb! : `assets/${def.id}/model.lod${lod}.glb`;
    await optimizeAsset(source, path, def);
    const validation = validateDocument(await (await assetIO()).read(path), def, readFileSync(path).length, lod);
    if (validation.errors.length) throw new Error(`${def.id}: ${validation.errors.join('; ')}`);
    validations.push(validation);
  }
  writeFileSync(`assets/${def.id}/report.json`, JSON.stringify(validations, null, 2) + '\n');
  writeFileSync(def.glb.replace('.glb', '.meta.json'), JSON.stringify({ ...validations[0], runtime: validations[0], nodes: (await (await assetIO()).read(def.glb)).getRoot().listNodes().map(n => ({ name: n.getName(), pivot: n.getWorldTranslation() })) }, null, 2) + '\n');
  console.log(def.id, validations.map(v => v.triangles));
}
