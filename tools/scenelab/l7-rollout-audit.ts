/** Audit the inherited L7 cast without broadening migration to unrendered native skins. */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { assetIO } from '../assets/io';
import { validateAssets } from '../assets/validate';
import type { AssetDef } from '../../src/assets/types';

const out = 'docs/reports/l7-all-new';
const census = JSON.parse(readFileSync(`${out}/census.json`, 'utf8')) as { baselineRevision: string; scope: string[]; review: string[]; carryover: string[] };
const manifest = JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as AssetDef[];
const baseline = JSON.parse(execFileSync('git', ['show', `${census.baselineRevision}:src/assets/manifest.json`], { encoding: 'utf8' })) as AssetDef[];
const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
if (process.argv.includes('--rebuild')) {
  const build = JSON.parse(readFileSync(`${out}/builds/npc.civilian-man-b/build.json`, 'utf8')) as { id: string; source: string; manualSteps: string[]; receipts: { tiers: { path: string }[] }[]; preparedBakes: Record<string, string> };
  assert.deepEqual(build.manualSteps, []);
  const files = [...new Set(['assets/npc.civilian-man-b/model.skin.glb', 'src/assets/manifest.json', 'src/assets/civilianBakes.json', ...build.receipts.flatMap(r => r.tiers.map(t => t.path)), ...Object.values(build.preparedBakes).map(path => `public${path}`)])];
  const before = files.map(path => ({ path, sha256: sha(path) }));
  execFileSync('sh', ['tools/assets/skin-crowd-build.sh', build.source], { env: { ...process.env, CROWD_REPORT: `${out}/builds` }, stdio: 'inherit' });
  const outputs = before.map(r => ({ ...r, repeatedSha256: sha(r.path), identical: r.sha256 === sha(r.path) }));
  assert.ok(outputs.every(r => r.identical));
  writeFileSync(`${out}/rebuild-proof.json`, JSON.stringify({ pass: true, id: build.id, source: build.source, manualSteps: [], inferenceSpendEUR: 0, files: outputs.length, outputs }, null, 2) + '\n');
}
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
    if (!courier) assert.ok(readFileSync(path).length <= [600000, 250000, 150000][lod], path);
    if (!courier && census.review.includes(id)) {
      assert.ok(triangles <= triangleCap, `${path}: ${triangles} > ${triangleCap}`);
    }
    lods.push({ lod, low, path, bytes: readFileSync(path).length, triangles, triangleCap, maxInfluences, sha256: sha(path), textures: document.getRoot().listTextures().map(t => ({ format: t.getMimeType(), size: t.getSize() })) });
  }
  figures.push({ id, courier, reviewed: census.review.includes(id), budget: def.budget, authoredLodTriangles: def.authoredLodTriangles, lods });
}
const validation = await validateAssets(census.carryover.filter(id => !id.startsWith('char.courier-')).map(id => manifest.find(d => d.id === id)!));
assert.deepEqual(validation.flatMap(r => r.errors), []);
writeFileSync(`${out}/validation.json`, JSON.stringify({ pass: true, records: validation.length, validation }, null, 2) + '\n');
const changed = [...new Set([execFileSync('git', ['diff', '--name-only', census.baselineRevision, '--', 'src', 'public', 'assets'], { encoding: 'utf8' }), execFileSync('git', ['ls-files', '--others', '--exclude-standard', 'src', 'public', 'assets'], { encoding: 'utf8' })].join('\n').split('\n').filter(Boolean))];
const allowed = /^(src\/assets\/(manifest|civilianBakes)\.json|assets\/npc\.civilian-man-b\/model\.skin\.glb|public\/assets\/models\/skinned\/npc\.civilian-man-b\.lod[012](\.low)?\.glb|public\/assets\/civilians\/npc\.civilian-man-b\.lod[012][^/]*\.bin\.gz)$/;
assert.deepEqual(changed.filter(path => !allowed.test(path)), [], 'Only the generated man-b cap fix may change production files');
assert.deepEqual(manifest.filter(d => d.id !== 'npc.civilian-man-b'), baseline.filter(d => d.id !== 'npc.civilian-man-b'));
const before = baseline.find(d => d.id === 'npc.civilian-man-b')!, after = manifest.find(d => d.id === before.id)!;
assert.deepEqual({ ...after, dimensions: before.dimensions }, before, 'Only measured dimensions may change in the figure definition');
const bakeBefore = JSON.parse(execFileSync('git', ['show', `${census.baselineRevision}:src/assets/civilianBakes.json`], { encoding: 'utf8' })), bakeAfter = JSON.parse(readFileSync('src/assets/civilianBakes.json', 'utf8'));
const otherBakes = (bakes: Record<string, string>) => Object.fromEntries(Object.entries(bakes).filter(([key]) => !key.startsWith('npc.civilian-man-b:')));
assert.deepEqual(otherBakes(bakeAfter), otherBakes(bakeBefore));
assert.equal(spawnSync('git', ['diff', '--exit-code', census.baselineRevision, '--', 'src/sim', 'src/data', 'src/render', 'src/levels'], { encoding: 'utf8' }).status, 0);
writeFileSync(`${out}/delivery-budget.json`, JSON.stringify({ pass: true, baselineRevision: census.baselineRevision, figures, reviewedByteCaps: [600000, 250000, 150000], triangleCaps: 'Unchanged inherited manifest caps, per identity and LOD; see each figure budget and authoredLodTriangles.', gameplayAndRendererUnchanged: true, manifestSha256: sha('src/assets/manifest.json'), generatedAssets: changed.map(path => ({ path, sha256: existsSync(path) ? sha(path) : null })), manualAssetSteps: [], huggingFaceSpendEUR: 0 }, null, 2) + '\n');
if (existsSync(`${out}/cap-fix.json`)) {
  const cap = JSON.parse(readFileSync(`${out}/cap-fix.json`, 'utf8'));
  const shape = (document: Awaited<ReturnType<typeof io.read>>) => ({
    triangles: document.getRoot().listNodes().flatMap(n => n.getMesh()?.listPrimitives() ?? []).reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION')!.getCount()) / 3, 0),
    primitives: document.getRoot().listNodes().flatMap(n => n.getMesh()?.listPrimitives() ?? []).length,
    textureExtents: document.getRoot().listTextures().map(t => ({ size: t.getSize(), format: t.getMimeType() })),
    skins: document.getRoot().listSkins().map(s => ({ joints: s.listJoints().map(n => n.getName()), inverseBinds: Array.from(s.getInverseBindMatrices()!.getArray()!) })),
  });
  const rows = [];
  for (const { path } of figures.find(f => f.id === 'npc.civilian-man-b')!.lods) {
    const bytes = execFileSync('git', ['show', `${census.baselineRevision}:${path}`], { maxBuffer: 5 * 1024 * 1024 });
    const before = shape(await io.readBinary(new Uint8Array(bytes))), current = shape(await io.read(path));
    assert.deepEqual(current, before);
    rows.push({ path, beforeBytes: bytes.length, afterBytes: readFileSync(path).length, baseline: before, current });
  }
  cap.rows = rows;
  cap.headwearClearance = JSON.parse(readFileSync(`${out}/builds/npc.civilian-man-b/lod0.json`, 'utf8')).headwearClearance;
  writeFileSync(`${out}/cap-fix.json`, JSON.stringify(cap, null, 2) + '\n');
}
console.log(JSON.stringify({ figures: figures.length, reviewed: census.review.length, validationRecords: validation.length, gameplayAndRendererUnchanged: true }));
