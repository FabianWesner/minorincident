import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import manifest from '../../src/assets/manifest.json';
import type { AssetDef } from '../../src/assets/types';
import { assetIO } from './io';
import { geometryHash, validateDocument } from './validate';
import { optimizeAsset } from './optimize';

/** A script failure aborts before replacing any committed runtime output. */
export async function buildAsset(def: AssetDef): Promise<string> {
  if (!def.script) throw new Error(`No build script for ${def.id}`);
  const raw = `.cache/assets/${def.id}.glb`;
  mkdirSync('.cache/assets', { recursive: true });
  const result = spawnSync('python3', ['tools/blender/run.py', 'tools/blender/build.py', '--asset', def.id, '--output', raw], { stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error(`Blender failed for ${def.id} (${result.status})`);
  const io = await assetIO(), document = await io.read(raw);
  const meta = validateDocument(document, def, readFileSync(raw).length);
  if (meta.errors.length) throw new Error(`Raw export invalid: ${meta.errors.join('; ')}`);
  await optimizeAsset(raw, def.glb, def);
  if (def.tier === 'hero') {
    for (const [lod, ratio] of [['lod1', .12], ['lod2', .035]] as const) {
      const supplied = `assets/${def.id}/model.${lod}.glb`;
      const output = def.lods?.[lod];
      if (!output) throw new Error(`Missing manifest ${lod} path`);
      await optimizeAsset(existsSync(supplied) ? supplied : raw, output, def, existsSync(supplied) ? 1 : ratio);
    }
  }
  const hash = geometryHash(document);
  writeFileSync(def.glb.replace(/\.glb$/, '.meta.json'), JSON.stringify({ ...meta, hash, nodes: document.getRoot().listNodes().map((n) => ({ name: n.getName(), pivot: n.getWorldTranslation() })) }, null, 2) + '\n');
  return hash;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const target = process.argv[2];
  const changed = target === '--changed' ? spawnSync('git', ['diff', '--name-only', 'HEAD'], { encoding: 'utf8' }).stdout : '';
  const selected = (manifest as AssetDef[]).filter((a) => target === '--all' ? !!a.script : target === '--changed' ? !!a.script && (changed.includes(a.script) || changed.includes('tools/blender/')) : a.id === target);
  if (!selected.length) throw new Error('Usage: npm run assets:build -- <id>|--all|--changed (no matching scripts)');
  for (const def of selected) console.log(`${def.id}: ${await buildAsset(def)}`);
}
