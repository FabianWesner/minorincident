/** Audit the inherited L7 cast without broadening migration to unrendered native skins. */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { assetIO } from '../assets/io';
import { validateAssets } from '../assets/validate';
import type { AssetDef } from '../../src/assets/types';

const out = 'docs/reports/l7-all-new';
const census = JSON.parse(readFileSync(`${out}/census.json`, 'utf8')) as { baselineRevision: string; scope: string[]; review: string[]; carryover: string[] };
const manifest = JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as AssetDef[];
const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const io = await assetIO(), figures = [];
assert.deepEqual(census.scope, [], 'The production census contains no unconverted figure');
for (const id of census.carryover) {
  const def = manifest.find(a => a.id === id)!; assert.ok(def, id);
  const courier = id.startsWith('char.courier-');
  assert.ok(courier || def.crowdSkin && def.textureMode === 'baseColor', id);
  const paths = courier ? ['skin', 'skin.low'].map((t, i) => ({ path: `public/assets/models/${id}.${t}.glb`, lod: 0, low: i === 1 })) : [def.glb!, def.lods!.lod1!, def.lods!.lod2!].flatMap((path, lod) => [{ path, lod, low: false }, { path: path.replace('.glb', '.low.glb'), lod, low: true }]);
  const lods = [];
  for (const { lod, path, low } of paths) {
    const document = await io.read(path); assert.ok(document.getRoot().listSkins().length, path);
    const triangles = document.getRoot().listNodes().flatMap(n => n.getMesh()?.listPrimitives() ?? []).reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION')!.getCount()) / 3, 0);
    let maxInfluences = 0;
    for (const mesh of document.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
      const weights = p.getAttribute('WEIGHTS_0'); if (!weights) continue;
      for (let i = 0; i < weights.getCount(); i++) { const row = weights.getElement(i, []); assert.ok(Math.abs(row.reduce((a, b) => a + b, 0) - 1) < .0001, path); maxInfluences = Math.max(maxInfluences, row.filter(w => w > 0).length); }
    }
    assert.ok(maxInfluences <= 4, path);
    const triangleCap = lod === 0 ? def.budget.triangles : def.authoredLodTriangles?.[lod === 1 ? 'lod1' : 'lod2'] ?? (lod === 1 && def.tier === 'hero' ? Math.ceil(def.budget.triangles * .15) : Math.min(4000, def.budget.triangles));
    if (!courier && census.review.includes(id)) {
      assert.ok(readFileSync(path).length <= [600000, 250000, 150000][lod], path);
      assert.ok(triangles <= triangleCap, `${path}: ${triangles} > ${triangleCap}`);
    }
    lods.push({ lod, low, path, bytes: readFileSync(path).length, triangles, triangleCap, maxInfluences, sha256: sha(path), textures: document.getRoot().listTextures().map(t => ({ format: t.getMimeType(), size: t.getSize() })) });
  }
  figures.push({ id, courier, reviewed: census.review.includes(id), budget: def.budget, authoredLodTriangles: def.authoredLodTriangles, lods });
}
const validation = await validateAssets(census.carryover.filter(id => !id.startsWith('char.courier-')).map(id => manifest.find(d => d.id === id)!));
assert.deepEqual(validation.flatMap(r => r.errors), []);
writeFileSync(`${out}/validation.json`, JSON.stringify({ pass: true, records: validation.length, validation }, null, 2) + '\n');
const productionDiff = spawnSync('git', ['diff', '--exit-code', census.baselineRevision, '--', 'src', 'public', 'assets'], { encoding: 'utf8' });
assert.equal(productionDiff.status, 0, 'No production data, gameplay, renderer or asset changed');
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', 'src', 'public', 'assets'], { encoding: 'utf8' }).trim(); assert.equal(untracked, '');
writeFileSync(`${out}/delivery-budget.json`, JSON.stringify({ pass: true, baselineRevision: census.baselineRevision, figures, reviewedByteCaps: [600000, 250000, 150000], triangleCaps: 'Unchanged inherited manifest caps, per identity and LOD; see each figure budget and authoredLodTriangles.', productionDiff: productionDiff.stdout, productionFilesUnchanged: true, manifestSha256: sha('src/assets/manifest.json'), generatedAssets: [], manualAssetSteps: [], huggingFaceSpendEUR: 0 }, null, 2) + '\n');
console.log(JSON.stringify({ figures: figures.length, reviewed: census.review.length, validationRecords: validation.length, productionFilesUnchanged: true }));
