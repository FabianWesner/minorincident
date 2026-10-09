import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import { dirname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import manifest from '../../src/assets/manifest.json';
import { variantPath, type AssetDef } from '../../src/assets/types';
import { assetIO } from './io';
import { requiredLods, triangleCount } from './delivery';
import { geometryHash, validateDocument } from './validate';
import { normalizeForward, normalizeScale, generateStumpCaps, optimizeAsset } from './optimize';

/** A script failure aborts before replacing any committed runtime output. */
export async function buildAsset(def: AssetDef, options: { quality?: 'high' | 'low'; decay?: string } = {}): Promise<string> {
  if (!def.script) throw new Error(`No build script for ${def.id}`);
  if (options.decay && !def.decayVariants.includes(options.decay)) throw new Error(`Unknown decay variant ${options.decay}`);
  if (options.decay) def = { ...def, budget: { ...def.budget, triangles: def.decayTriangleBudget ?? def.budget.triangles, ...def.decayBudget }, dimensions: { ...def.dimensions, ...def.decayDimensions }, authoredLodTriangles: def.decayAuthoredLodTriangles ?? def.authoredLodTriangles };
  const raw = `.cache/assets/${def.id}.glb`;
  mkdirSync('.cache/assets', { recursive: true });
  const args = ['tools/blender/run.py', 'tools/blender/build.py', '--asset', def.id, '--output', raw, '--quality', options.quality ?? 'high', '--bake-ao'];
  if (options.decay) args.push('--decay',options.decay);
  const result = spawnSync('python3', args, { stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error(`Blender failed for ${def.id} (${result.status})`);
  const io = await assetIO(), document = await io.read(raw);
  normalizeForward(document, def);
  normalizeScale(document, def);
  generateStumpCaps(document, def);
  const meta = validateDocument(document, { ...def, sourceGlb: undefined, budget: { ...def.budget, fileKB: Infinity } }, readFileSync(raw).length);
  // Zero-area exporter faces are repaired below; every runtime tier still gets full validation.
  const rawErrors = meta.errors.filter(error => !error.includes('degenerate triangle'));
  if (rawErrors.length) throw new Error(`Raw export invalid: ${rawErrors.join('; ')}`);
  const stage = mkdtempSync('.cache/assets/stage-');
  const outputs: [string,string][] = [];
  try {
    const output = variantPath(def.glb,options.decay), staged = `${stage}/${basename(output)}`;
    await optimizeAsset(raw, staged, def);
    const runtime = validateDocument(await io.read(staged), def, readFileSync(staged).length);
    if (runtime.errors.length) throw new Error(`Optimized export invalid: ${runtime.errors.join('; ')}`);
    outputs.push([staged,output]);
    if (requiredLods(def, triangleCount(document)).length) {
      for (const lod of requiredLods(def, triangleCount(document))) {
        const ratio = lod === 'lod1' ? .12 : .03;
        const supplied = variantPath(`assets/${def.id}/model.${lod}.glb`, options.decay);
        const output = def.lods?.[lod] && variantPath(def.lods[lod]!,options.decay);
        if (!output) throw new Error(`Missing manifest ${lod} path`);
        const staged = `${stage}/${basename(output)}`;
        const generatedRatio = def.generatedLodRatios?.[lod];
        const generated = existsSync(supplied) && (await io.read(supplied)).getRoot().listScenes().some(scene => scene.getExtras().deliveryLodGenerated === true);
        const useSupplied = !generated && generatedRatio === undefined && existsSync(supplied);
        if (def.authoredLodTriangles && !useSupplied) throw new Error(`${def.id}: missing authored ${lod} (${supplied})`);
        await optimizeAsset(useSupplied ? supplied : raw, staged, def, useSupplied ? 1 : generatedRatio ?? (lod === 'lod1' && def.category === 'infected' ? .10 : ratio));
        const validation = validateDocument(await io.read(staged), def, readFileSync(staged).length, lod === 'lod1' ? 1 : 2);
        if (validation.errors.length) throw new Error(`${lod} invalid: ${validation.errors.join('; ')}`);
        outputs.push([staged,output]);
      }
    }
    const hash = geometryHash(document);
    const metadata = output.replace(/\.glb$/, '.meta.json'), stagedMeta = `${stage}/${basename(metadata)}`;
    writeFileSync(stagedMeta, JSON.stringify({ ...meta, hash, runtime, nodes: document.getRoot().listNodes().map((n) => ({ name: n.getName(), pivot: n.getWorldTranslation() })) }, null, 2) + '\n');
    outputs.push([stagedMeta,metadata]);
    // Publish only after every tier has passed validation.
    for (const [source,destination] of outputs) { mkdirSync(dirname(destination),{recursive:true}); renameSync(source,destination); }
    return hash;
  } finally { rmSync(stage,{recursive:true,force:true}); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const target = process.argv[2];
  const changed = target === '--changed' ? spawnSync('git', ['diff', '--name-only', 'HEAD'], { encoding: 'utf8' }).stdout : '';
  const selected = (manifest as AssetDef[]).filter((a) => target === '--all' ? !!a.script : target === '--changed' ? !!a.script && (changed.includes(a.script) || changed.includes('tools/blender/')) : a.id === target);
  if (!selected.length) throw new Error('Usage: npm run assets:build -- <id>|--all|--changed (no matching scripts)');
  const quality = process.argv.includes('--quality') ? process.argv[process.argv.indexOf('--quality')+1] : 'high';
  if (process.argv.includes('--quality') && quality !== 'high' && quality !== 'low') throw new Error('Quality must be high or low');
  const decay = process.argv.includes('--decay') ? process.argv[process.argv.indexOf('--decay')+1] : undefined;
  for (const def of selected) console.log(`${def.id}: ${await buildAsset(def,{quality:quality === 'low' ? 'low' : 'high',decay})}`);
}
