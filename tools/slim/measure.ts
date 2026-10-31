/** Reproducible bind-pose census, including retained bulk and child exceptions. */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { AssetDef } from '../../src/assets/types';
import { assetIO } from '../assets/io';
import { keys, measureBuild, referenceBuild } from './anatomy';
export const baseline = '53949e814';
const phase = process.argv[2] ?? 'before';
const original = (path: string) => execFileSync('git', ['show', `${baseline}:${path}`], { maxBuffer: 64 * 1024 * 1024 });
const baselineDefs=JSON.parse(original('src/assets/manifest.json').toString()) as AssetDef[];
const defs = phase==='before'?baselineDefs:JSON.parse(readFileSync('src/assets/manifest.json','utf8'))as AssetDef[];
const census = JSON.parse(readFileSync('docs/reports/q249/rollout/census.json', 'utf8')) as { rows: { id: string; rootName?: string; child?: boolean }[] };
const io = await assetIO(), rows = [];
for (const row of [{ id: 'char.courier-female', child: false, rootName: undefined }, ...census.rows]) {
  const def = defs.find(d => d.id === row.id)!;
  const path = row.id === 'char.courier-female' ? 'public/assets/models/char.courier-female.skin.glb' : row.id === 'char.courier-male' ? 'public/assets/models/char.courier-male.skin.glb' : def.glb;
  const policy = row.id === 'char.courier-female' ? 'reference' : row.child ? 'child' : /alpha|bloated|brute/.test(row.id) ? 'retained intentional bulk' : 'adult';
  try {
    const doc = await io.readBinary(phase === 'before' ? original(path) : readFileSync(path));
    rows.push({ ...row, policy, path, ...measureBuild(doc, row.rootName, phase==='before'?undefined:referenceBuild(await io.readBinary(original(row.id==='char.courier-female'?'public/assets/models/char.courier-female.skin.glb':row.id==='char.courier-male'?'public/assets/models/char.courier-male.skin.glb':baselineDefs.find(d=>d.id===row.id)!.glb)),row.rootName)) });
  } catch (error) { rows.push({ ...row, policy, path, error: String(error) }); }
}
mkdirSync('docs/reports/slim', { recursive: true });
writeFileSync(`docs/reports/slim/measurements${phase === 'before' ? '' : '-after'}.json`, JSON.stringify({ baseline, phase, rows }, null, 2) + '\n');
if (phase === 'before') {
  const fmt = (v?: number) => v === undefined || !Number.isFinite(v) ? 'n/a*' : v.toFixed(4);
  const md = ['# Slim build', '', `Baseline: \`${baseline}\`. Every q249 human figure is included below; children and the intentionally bulky Alphas/brute/bloated are measured and identified for retention. Ratios are invariant under q257’s uniform delivery height fit.`, '',
    'Measurements use visible indexed bind-pose geometry; hidden stump caps, eyes and hand props are excluded. Each limb radius is the 95th percentile perpendicular distance from its own bone axis, in the middle 40–60% of that segment (thigh: leg→shin, calf: shin→foot). Torso width/depth are the 2–98% envelope in the lower torso band 20–40% from pelvis to shoulder, excluding limb surfaces assigned to the nearest arm capsule and the courier backpack region. Limb radii retain the authored joint ownership; the body surface split only prevents a folded sleeve or backpack from setting torso thickness. After comparisons freeze the baseline vertex ownership and cross-section membership, so a shifted sleeve cannot change which body section is being measured. Shoes are measured separately by foot/toe ownership; the larger 2–98% length and height is reported. This avoids combining both feet, flared hems or a backpack with body thickness.', '',
    '| Figure | Policy | Upper arm r/H | Forearm r/H | Thigh r/H | Calf r/H | Torso W/H | Torso D/H | Shoe L/H | Shoe H/H |', '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...rows.map(r => `| ${r.id}${r.rootName ? ' / ' + r.rootName : ''} | ${r.policy} | ${keys.map(k => fmt('ratios' in r ? r.ratios[k] : undefined)).join(' | ')} |`), '',
    '* n/a: no visible geometry for this anatomical part. Sparse bone ownership uses the nearest same-side visible cross-section; exact fallbacks are identified per figure in JSON.', '',
    ...rows.filter(r => 'error' in r).map(r => `* ${r.id}: ${r.error}`), ''];
  const previous=existsSync('docs/reports/slim/README.md')?readFileSync('docs/reports/slim/README.md','utf8'):'';const footer=previous.indexOf('\n## Pilot and rollout');
  writeFileSync('docs/reports/slim/README.md', md.join('\n')+(footer>=0?previous.slice(footer):''));
}
console.log(`${rows.length} figures; ${rows.filter(r => 'error' in r).length} measurement exceptions`);
