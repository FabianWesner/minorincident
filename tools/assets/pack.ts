import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import manifest from '../../src/assets/manifest.json';
import type { AssetDef } from '../../src/assets/types';
import { assetIO } from './io';
import { optimizeAsset } from './optimize';
import { requiredLods, triangleCount } from './delivery';
import { packStatic } from './pack-static';
import { writeStaticCollision } from './bake-static-collision';

/** Pack existing detailed exports without invoking or changing their Blender builds. */
export async function packAsset(def: AssetDef, regenerate = false): Promise<number> {
  const source = def.sourceGlb ?? def.glb;
  const io = await assetIO();
  await optimizeAsset(source, def.glb, def);
  const triangles = triangleCount(await io.read(def.glb));
  let added = 0;
  for (const lod of requiredLods(def, triangles)) {
    const supplied = `assets/${def.id}/model.${lod}.glb`, output = def.lods?.[lod] ?? def.glb.replace('.glb', `.${lod}.glb`);
    if (!output) throw new Error(`${def.id}: missing ${lod} manifest path`);
    if (def.authoredLodRatios) {
      if (regenerate) throw new Error(`${def.id}: rebuild reviewed LODs from the Blender source`);
      if (!existsSync(supplied)) throw new Error(`${def.id}: missing authored ${lod}`);
      await optimizeAsset(supplied, output, def);
      const actual = triangleCount(await io.read(output)) / triangles;
      if (actual > def.authoredLodRatios[lod] + .005) throw new Error(`${def.id}: authored ${lod} ratio ${actual} exceeds ${def.authoredLodRatios[lod]}`);
      continue;
    }
    const ratio = lod === 'lod1' ? .12 : .03;
    const generated = existsSync(supplied) && (await io.read(supplied)).getRoot().listScenes().some(scene => scene.getExtras().deliveryLodGenerated === true);
    // Existing authored tiers are preferred when they meet the delivery contract.
    if (!regenerate && !generated && existsSync(supplied)) await optimizeAsset(supplied, output, def);
    const count = existsSync(output) ? triangleCount(await io.read(output)) : Infinity;
    if (regenerate || generated || !existsSync(supplied) || count > triangles * (lod === 'lod1' ? .155 : .045) || (lod === 'lod1' && statSync(output).size > statSync(def.glb).size * .25)) {
      let target = ratio;
      for (let attempt = 0; attempt < 4; attempt++) {
        await optimizeAsset(source, output, def, target);
        const actual = triangleCount(await io.read(output)) / triangles;
        const byteRatio = statSync(output).size / statSync(def.glb).size;
        if (actual <= (lod === 'lod1' ? .155 : .045) && (lod !== 'lod1' || byteRatio <= .25)) break;
        const next = Math.max(lod === 'lod1' ? .08 : .015, target * Math.min(.8, (lod === 'lod1' ? .14 : .035) / actual, lod === 'lod1' ? .23 / byteRatio : 1));
        if (next === target) break; // A repeated clamped target would produce identical bytes.
        target = next;
      }
      if (!existsSync(supplied)) added++;
      copyFileSync(output, supplied);
    }
  }
  return added;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const target = process.argv[2] ?? '--all';
  const selected = (manifest as AssetDef[]).map(def => !def.sourceGlb && existsSync(`assets/${def.id}/model.glb`) ? { ...def, sourceGlb: `assets/${def.id}/model.glb`, sourceForward: def.sourceForward ?? '+X' as const } : def).filter(def => def.sourceGlb && (target === '--all' || def.id === target || def.id.startsWith(`${target}.`)));
  if (!selected.length) throw new Error('Usage: assets:pack -- [--all|<id>|<prefix>]');
  let added = 0;
  for (const def of selected) { added += await packAsset(def, process.argv.includes('--regenerate')); console.log(def.id); }
  mkdirSync('.cache/assets', { recursive: true });
  writeFileSync('.cache/assets/pack-result.json', JSON.stringify({ added, assets: selected.length }) + '\n');
  if (target === '--all') {
    for (const file of readdirSync('public/assets/layouts').filter(file => file.endsWith('.glb'))) await packStatic(`public/assets/layouts/${file}`);
    for (const file of readdirSync('public/assets/models').filter(file => file.endsWith('.crowd.glb'))) await packStatic(`public/assets/models/${file}`);
  }
  if (selected.some(def => def.world || def.id.startsWith('prop.') || def.id.startsWith('veh.') || def.id === 'int.pharmacy-clinic')) await writeStaticCollision();
  const basis = 'node_modules/three/examples/jsm/libs/basis';
  mkdirSync('public/assets/basis', { recursive: true });
  for (const file of ['basis_transcoder.js', 'basis_transcoder.wasm']) copyFileSync(`${basis}/${file}`, `public/assets/basis/${file}`);
  console.log(JSON.stringify({ added, assets: selected.length }));
}
