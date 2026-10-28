/** Verify campaign rollout censuses against actual shipped skins, and audit retired callers/assets. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { assetIO } from '../assets/io';
import { validateSpec, type SceneSpec } from '../../src/debug/scenelab/spec';
import { variantPath, type AssetDef } from '../../src/assets/types';

const base = '6363147b2', out = 'docs/reports/p01-rigid-retire';
const manifest = JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as AssetDef[];
const sha = (data: Uint8Array | string) => createHash('sha256').update(data).digest('hex');
const byId = new Map(manifest.map(def => [def.id, def]));
const definition = (id: string) => byId.get(id) ?? byId.get(id.replace(/\.(black|cream)$/, ''));
const levels: { level: number; report: string; reportSha256: string; figures: number; v2: number; coverage: number; ids: string[] }[] = [];
const all = new Set<string>();
for (let level = 1; level <= 10; level++) {
  const report = level === 1 ? 'docs/reports/skinned-prod/l1-census.json' : `docs/reports/l${level}-all-new/census.json`;
  const bytes = readFileSync(report), d = JSON.parse(bytes.toString());
  const ids = new Set<string>();
  const add = (values: string[]) => { for (const id of values) for (const member of id.split('|')) ids.add(member.trim()); };
  if (level <= 3) { for (const receipt of d.receipts) add(Object.keys(receipt.counts)); add(d.additionalPotential ?? []); if (level === 1) add(Object.keys(d.sources)); }
  else if ([4, 5, 7].includes(level)) { add(d.rows.map((row: { id: string }) => row.id)); add(d.carryover ?? []); add(d.review ?? []); for (const row of d.delegated ?? []) ids.add(row.id); }
  else if (level === 6) add(d.figures.map((row: { id: string }) => row.id));
  else if (level === 8) { add(d.review); add(d.alreadyV2); assert.deepEqual(d.batch3Remainder, []); }
  else if (level === 9) add(d.identities.map((row: { id: string }) => row.id));
  else add(d.population.map((row: { asset: string }) => row.asset));
  assert.ok(ids.size > 0, report);
  for (const id of ids) {
    const def = definition(id); assert.ok(def, `${report}: missing ${id}`);
    assert.ok(id.startsWith('char.courier-') || def.crowdSkin && def.textureMode === 'baseColor', `${report}: non-v2 ${id}`);
    all.add(id);
  }
  levels.push({ level, report, reportSha256: sha(bytes), figures: ids.size, v2: ids.size, coverage: 100, ids: [...ids].sort() });
}
const io = await assetIO(), paths = new Map<string, { path: string; bytes: number; skins: number; weightedPrimitives: number; sha256: string; unchangedFromBase: boolean }>();
for (const id of all) {
  const def = definition(id)!;
  const files = id.startsWith('char.courier-') ? [`public/assets/models/${id}.skin.glb`, `public/assets/models/${id}.skin.low.glb`]
    : [def.glb, def.lods!.lod1!, def.lods!.lod2!].flatMap(path => [path, path.replace(/\.glb$/, '.low.glb')]).map(path => variantPath(path, id === def.id ? undefined : id.split('.').at(-1)));
  for (const path of files) {
    if (paths.has(path)) continue;
    assert.ok(existsSync(path), path);
    const data = readFileSync(path), document = await io.read(path);
    const skins = document.getRoot().listSkins().length;
    const weightedPrimitives = document.getRoot().listMeshes().flatMap(mesh => mesh.listPrimitives()).filter(p => p.getAttribute('JOINTS_0') && p.getAttribute('WEIGHTS_0')).length;
    assert.ok(skins && weightedPrimitives, `No shipped skin: ${path}`);
    const before = execFileSync('git', ['show', `${base}:${path}`], { maxBuffer: 1 << 26 });
    const unchangedFromBase = sha(data) === sha(before); assert.ok(unchangedFromBase, `Figure asset changed: ${path}`);
    paths.set(path, { path, bytes: data.length, skins, weightedPrimitives, sha256: sha(data), unchangedFromBase });
  }
}
const removed = execFileSync('git', ['diff', '--name-only', '--diff-filter=D', base], { encoding: 'utf8' }).trim().split('\n').filter(path => path.startsWith('public/assets/'));
const retired = removed.map(path => ({ path, bytes: Number(execFileSync('git', ['cat-file', '-s', `${base}:${path}`], { encoding: 'utf8' }).trim()) }));
const sourceFiles = execFileSync('git', ['ls-files', 'src', 'tools', 'tests', 'preview', 'package.json'], { encoding: 'utf8' }).split('\n').filter(path => /\.(ts|tsx|mjs|js|json|py|html)$/.test(path) && existsSync(path) && path !== 'tools/scenelab/p01-retirement-audit.ts' && !path.startsWith('tests/fixtures/reports/'));
const forbidden = ['rigidBaseline', 'createInfectedPlaceholder', 'livingSource(', 'simplifyCrowdLod', 'loadCorpse(', 'corpseGlb', 'skinCrowd=rigid', 'crowdLodGeometry', 'infectedPlaceholder', 'bake-crowd', 'bake-corpses', 'compact-crowd-audit'];
const references: { file: string; reference: string }[] = [];
for (const file of sourceFiles) {
  const text = readFileSync(file, 'utf8');
  for (const symbol of forbidden) if (text.includes(symbol)) references.push({ file, reference: symbol });
  for (const { path } of retired) if (text.includes(path) || text.includes('/' + path.replace(/^public\//, ''))) references.push({ file, reference: path });
}
assert.deepEqual(references, [], 'Retired runtime, tool, preview, fixture or asset references remain');
const sceneFiles = execFileSync('git', ['ls-files', 'specs/scenes', 'tests/scenes'], { encoding: 'utf8' }).split('\n').filter(path => path.endsWith('.json') && existsSync(path));
const retiredFixtureCases = sceneFiles.flatMap(file => {
  const spec = JSON.parse(readFileSync(file, 'utf8')) as SceneSpec;
  if (!spec.actors) return [];
  const errors = validateSpec(spec, byId).filter(error => error.includes('retired rigid figure'));
  return errors.length ? [{ file, errors }] : [];
});
const pendingFixtureActors = retiredFixtureCases.reduce((n, row) => n + row.errors.length, 0);
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/retirement-audit.json`, JSON.stringify({ pass: pendingFixtureActors === 0, campaignCoveragePass: true, pendingFixtureActors, retiredFixtureCases, base, levels, uniqueFigures: all.size, shippedFiles: paths.size, allFigureAssetBytesUnchanged: true, assets: [...paths.values()], retiredFiles: retired.length, retiredAssetBytes: retired.reduce((n, row) => n + row.bytes, 0), retired, references }, null, 2) + '\n');
console.log(JSON.stringify({ levels: levels.map(({ level, figures, coverage }) => ({ level, figures, coverage })), uniqueFigures: all.size, shippedFiles: paths.size, pendingFixtureActors, retiredFiles: retired.length, retiredAssetBytes: retired.reduce((n, row) => n + row.bytes, 0), references: references.length }));

if (pendingFixtureActors) process.exitCode = 1;
