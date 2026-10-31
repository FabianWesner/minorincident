/** Pilot first; after its visual review, --rollout applies the same offline edit to the human cast. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { getBounds, prune } from '@gltf-transform/functions';
import type { AssetDef } from '../../src/assets/types';
import { assetIO } from '../assets/io';
import { skinCrowdBakes } from '../assets/skin-crowd-bakes';
import { measureFigure } from '../assets/figure-proportions';
import { keys, measureBuild } from './anatomy';
import { planBuild, slimBuild } from './deform';
import { headReference } from './head-reference';
const baseline = '53949e814', rollout = process.argv.includes('--rollout'), planOnly = process.argv.includes('--plan');
const original = (path: string) => execFileSync('git', ['show', `${baseline}:${path}`], { maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const oldDefs = JSON.parse(original('src/assets/manifest.json').toString()) as AssetDef[];
const manifest = JSON.parse(original('src/assets/manifest.json').toString()) as AssetDef[];
const census = JSON.parse(readFileSync('docs/reports/q249/rollout/census.json', 'utf8')) as { rows: { id: string; rootName?: string; child?: boolean }[] };
const ids = rollout ? [...new Set(census.rows.filter(r => !r.child && !/alpha|brute|bloated/.test(r.id)).map(r => r.id))] : ['npc.civilian-man-a', 'npc.civilian-woman-a'];
const io = await assetIO(), heroine = await io.read('public/assets/models/char.courier-female.skin.glb'), target = measureBuild(heroine).ratios, caps = measureFigure(heroine).ratios;
const maleProfile = planBuild(measureBuild(await io.readBinary(original(oldDefs.find(d => d.id === 'npc.civilian-man-a')!.glb))).ratios, target);
const bakes = JSON.parse(original('src/assets/civilianBakes.json').toString()) as Record<string, string>, receipts = [];
const report = `docs/reports/slim/${rollout ? 'rollout' : 'pilot'}`; mkdirSync(report, { recursive: true });
for (const id of ids.filter(id => !process.env.SLIM_IDS || process.env.SLIM_IDS.split(',').includes(id))) {
  const old = oldDefs.find(d => d.id === id)!, def = manifest.find(d => d.id === id)!;
  const paths = [...new Set([old.sourceGlb!, old.glb, ...Object.values(old.lods ?? {}), ...[old.glb, ...Object.values(old.lods ?? {})].map(p => p.replace('.glb', '.low.glb')), ...(id === 'char.courier-male' ? ['assets/char.courier-male-skin/model.skin.glb', 'public/assets/models/char.courier-male.skin.glb', 'public/assets/models/char.courier-male.skin.low.glb'] : [])])];
  const files = [], outputs = new Map<string, string>();
  for (const path of paths) {
    let input: Buffer; try { input = original(path); } catch { continue; }
    const doc = await io.readBinary(input), images = doc.getRoot().listTextures().map(t => sha(t.getImage()!));
    const roots = id === 'npc.survivor-group' ? census.rows.filter(r => r.id === id).map(r => r.rootName) : [undefined];
    const figures = [];
    for (const rootName of roots) {
      const before = measureBuild(doc, rootName), plan = id === 'inf.crawler' ? { ...maleProfile } : planBuild(before.ratios, target);
      plan.shoulderReference = headReference(path, rootName);
      // Skin blends and a protected shoulder rim attenuate a torso contraction.
      // Solve against the resulting visible envelope from the unchanged input.
      for (let pass = 0; pass < (id === 'inf.crawler' ? 0 : 8); pass++) {
        const trial = await io.readBinary(input), sample = slimBuild(trial, plan, rootName).after;
        let changed = false;
        if (!plan.shoulderGuard && measureFigure(trial, rootName, plan.shoulderReference).ratios.headShoulder > caps.headShoulder * 1.1 + 1e-5) {
          plan.shoulderGuard = true; continue;
        }
        for (const k of ['torsoWidth', 'torsoDepth'] as const) {
          if (sample.ratios[k] <= target[k] * 1.145 && (before.ratios[k] < target[k] * .85 || sample.ratios[k] >= target[k] * .87)) continue;
          const response = (before.ratios[k] - sample.ratios[k]) / (1 - plan[k]);
          if (!(response > 0)) continue;
          plan[k] = Math.min(1, Math.max(.01, plan[k] - (sample.ratios[k] - target[k] * 1.12) / response)); changed = true;
        }
        if (!changed) break;
      }
      const result = slimBuild(doc, plan, rootName), head = measureFigure(doc, rootName, plan.shoulderReference);
      if (id !== 'inf.crawler' && (head.ratios.headHeight > caps.headHeight * 1.1 + 1e-5 || head.ratios.headShoulder > caps.headShoulder * 1.1 + 1e-5)) throw Error(`${id} ${path}: q249 cap changed ${JSON.stringify({reference:plan.shoulderReference,guard:plan.shoulderGuard,head:head.ratios,baseline:measureFigure(await io.readBinary(input),rootName,plan.shoulderReference).ratios})}`);
      if(id!=='inf.crawler')for(const k of ['torsoWidth','torsoDepth']as const)if(result.after.ratios[k]>target[k]*1.15+1e-5||(before.ratios[k]>=target[k]*.85&&result.after.ratios[k]<target[k]*.85-1e-5))throw Error(`${id} ${path}: torso outside reference interval ${k} ${result.after.ratios[k]/target[k]}`);
      if (Math.abs(result.before.heightM - result.after.heightM) > 1e-5) throw Error(`${id} ${path}: height changed`);
      figures.push({ rootName, ...result });
    }
    if (JSON.stringify(images) !== JSON.stringify(doc.getRoot().listTextures().map(t => sha(t.getImage()!)))) throw Error('Texture bytes changed');
    await doc.transform(prune({ keepLeaves: true, keepAttributes: true }));
    const pilot = ['npc.civilian-man-a', 'npc.civilian-woman-a'].includes(id);
    const output = pilot ? path === old.sourceGlb ? `assets/${id}/model.slim.skin.glb` : `public/assets/models/slim-pilot/${id}.${path.split('/').at(-1)!.split('.').slice(-2).join('.')}` : path;
    // Preserve lodN.low names; source inputs use the dedicated source path above.
    const finalOutput = pilot && path !== old.sourceGlb ? `public/assets/models/slim-pilot/${id}.${/lod[012](?:\.low)?\.glb$/.exec(path)?.[0] ?? path.split('/').at(-1)}` : output;
    mkdirSync(finalOutput.slice(0, finalOutput.lastIndexOf('/')), { recursive: true }); if (!planOnly) await io.write(finalOutput, doc); outputs.set(path, finalOutput);
    if (path === old.glb) { const body = doc.getRoot().listNodes().find(n => n.getName() === 'skin_body') ?? doc.getRoot().listScenes()[0]; const b = getBounds(body); def.dimensions = { ...def.dimensions, x: b.max[0] - b.min[0], y: b.max[1] - b.min[1], z: b.max[2] - b.min[2] }; }
    files.push({ input: path, output: finalOutput, texturesUnchanged: true, figures });
  }
  def.sourceGlb = outputs.get(old.sourceGlb!)!; def.glb = outputs.get(old.glb)!; def.lods = Object.fromEntries(Object.entries(old.lods ?? {}).map(([lod, path]) => [lod, outputs.get(path)!]));
  if (!planOnly && def.crowdSkin) Object.assign(bakes, await skinCrowdBakes(def));
  receipts.push({ id, files }); console.log('BUILT', id, files.length);
  writeFileSync(`${report}/${planOnly ? 'plan' : 'build'}.json`, JSON.stringify({ baseline, target, keys, receipts }, null, 2) + '\n');
}
if (!planOnly) writeFileSync('src/assets/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
if (!planOnly) writeFileSync('src/assets/civilianBakes.json', JSON.stringify(bakes, null, 2) + '\n');
