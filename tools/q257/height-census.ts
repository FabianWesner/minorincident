/** Census of actual delivered GPU geometry, including its offline load-time fit. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { AssetDef } from '../../src/assets/types';
import { decodeCivilianBake } from '../../src/assets/civilianBakeData';
import { assetIO } from '../assets/io';
import { measureFigure } from '../assets/figure-proportions';
import { civilianHeight, heroineStandingHeight, adultMaleStandingHeight } from '../../src/render/npc/figureHeight';

const batch40 = 'fd8f56ca3', main = '73a855ef6';
const read = (revision: string | undefined, path: string) => revision ? execFileSync('git', ['show', `${revision}:${path}`], { maxBuffer: 64 * 1024 * 1024 }) : readFileSync(path);
const census = JSON.parse(readFileSync('docs/reports/q249/rollout/census.json', 'utf8')) as { rows: { id: string; path: string; rootName?: string; child?: boolean; error?: string }[] };
const io = await assetIO();
const states = [batch40, main, undefined].map(revision => ({ revision, manifest: JSON.parse(read(revision, 'src/assets/manifest.json').toString()) as AssetDef[], bakes: JSON.parse(read(revision, 'src/assets/civilianBakes.json').toString()) as Record<string, string> }));
type Size = { height: number; ground: number; source: string };
async function measure(state: typeof states[number], row: typeof census.rows[number]): Promise<{ route: string; tiers: Record<string, Size> }> {
  const def = state.manifest.find(d => d.id === row.id)!;
  const role = row.id.startsWith('npc.') ? '' : ':infected';
  if (def.crowdSkin && state.bakes[`${row.id}:lod1${role}`]) {
    const tiers: Record<string, Size> = {};
    for (const lod of ['lod0', 'lod1', 'lod2']) {
      const source = 'public' + state.bakes[`${row.id}:${lod}${role}`];
      const bytes = gunzipSync(read(state.revision, source));
      const bake = decodeCivilianBake(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      const position = bake.geometry.getAttribute('position'), parts = bake.geometry.getAttribute('_parts'), marks = bake.geometry.getAttribute('_vein'), eyes = bake.geometry.getAttribute('_emissive');
      let low = Infinity, high = -Infinity;
      for (let i = 0; i < position.count; i++) if (parts ? parts.getW(i) < 1024 && parts.getZ(i) < 1.5 : (marks?.getX(i) ?? 0) < 1024 && (eyes?.getX(i) ?? 0) < 1.5) { low = Math.min(low, position.getY(i)); high = Math.max(high, position.getY(i)); }
      tiers[lod] = { height: high - low, ground: low, source }; bake.geometry.dispose();
    }
    return { route: row.id.startsWith('npc.') ? 'civilian GPU' : 'infected GPU', tiers };
  }
  const source = row.id === 'char.courier-male' ? 'public/assets/models/char.courier-male.skin.glb' : def.glb;
  const size = measureFigure(await io.readBinary(read(state.revision, source)), row.rootName);
  let height = size.height, route = 'retained legacy asset';
  if (row.id.startsWith('char.')) { route = 'CharacterView'; if (!state.revision) height = row.id.includes('female') ? heroineStandingHeight : adultMaleStandingHeight; }
  else if (['npc.brother', 'npc.mrs-alvarez'].includes(row.id)) {
    route = 'escort'; const target = state.revision ? row.id === 'npc.brother' ? 1.4265 : 1.8 : civilianHeight(row.id);
    if (Math.abs(height / target - 1) > (state.revision ? .08 : .005)) height = target;
  }
  return { route, tiers: { lod0: { height, ground: size.ground, source } } };
}
const rows = [];
const errors: string[] = [];
const heroine = measureFigure(await io.read('public/assets/models/char.courier-female.skin.glb')).height;
for (const row of census.rows.filter(r => !r.error)) {
  const [prod, baseline, after] = await Promise.all(states.map(state => measure(state, row)));
  if (after.route === 'civilian GPU' || after.route === 'CharacterView' || after.route === 'escort') {
    for (const [lod, measured] of Object.entries(after.tiers)) {
      const id = row.id, target = civilianHeight(id), ratio = measured.height / heroine;
      if (row.child) {
        const before = prod.tiers[lod] ?? prod.tiers.lod0, expected = before.height / 1.8 * heroine;
        if (Math.abs(measured.height - expected) > .001) errors.push(`${id} ${lod}: child/adult ratio changed`);
        if (measured.height >= heroine * .95) errors.push(`${id} ${lod}: child not shorter than every adult class`);
      }
      else if (/elderly/.test(id)) { if (measured.height < adultMaleStandingHeight * .95 - .001 || measured.height > adultMaleStandingHeight + .001) errors.push(`${id} ${lod}: elderly height ${measured.height}`); }
      else if (target === heroineStandingHeight) { if (ratio < .95 || ratio > 1.05) errors.push(`${id} ${lod}: female/heroine ratio ${ratio}`); }
      else if (ratio < 1.05 || ratio > 1.12) errors.push(`${id} ${lod}: male/heroine ratio ${ratio}`);
    }
  }
  rows.push({ id: row.id, root: row.rootName, child: !!row.child, route: after.route, prod, main: baseline, after });
}
const fmt = (n: number) => n.toFixed(3), value = (s: { tiers: Record<string, Size> }) => (s.tiers.lod1 ?? s.tiers.lod0).height;
const markdown = [
  '# q257 height census', '',
  `Heroine skinned bind height: **${fmt(heroine)} m**. Delivered healthy women target ${fmt(heroineStandingHeight)} m; men ${fmt(adultMaleStandingHeight)} m (+8%); elderly man ${fmt(civilianHeight('npc.civilian-elderly'))} m (male × 0.95). Children preserve their PROD child/adult ratios against women: child ${fmt(civilianHeight('npc.civilian-kid'))} m (1.4744 / 1.8); brother ${fmt(civilianHeight('npc.brother'))} m (1.4265 / 1.8). **${errors.length} class/child errors** across every delivered LOD.`,
  'PROD batch 40 = `fd8f56ca3`; main before q257 = `73a855ef6` (q249 rollout). GPU rows measure the actual encoded geometry referenced by each revision’s delivery manifest, after its offline normalizer; they do not assume a target was applied. The table uses the normal game LOD1; JSON records LOD0/1/2, ground planes and exact delivery files. Character/escort rows include their runtime uniform fit. Retained legacy assets have no production spawn and are measured separately; infected archetypes retain their authored heights/poses.', '',
  '| Figure | Renderer | PROD 40 (m) | main (m) | after (m) |', '|---|---|---:|---:|---:|',
  `| Heroine | CharacterView | ${fmt(heroine)} | ${fmt(heroine)} | ${fmt(heroine)} |`,
  ...rows.map(r => `| ${r.id}${r.root ? ` / ${r.root}` : ''} | ${r.route} | ${fmt(value(r.prod))} | ${fmt(value(r.main))} | ${fmt(value(r.after))} |`), ''
].join('\n');
mkdirSync('docs/reports/q257', { recursive: true });
writeFileSync('docs/reports/q257/height-census.json', JSON.stringify({ batch40, main, heroine, errors, rows }, null, 2) + '\n');
writeFileSync('docs/reports/q257/height-census.md', markdown);
console.log(`${rows.length + 1} figures; ${errors.length} errors`); if (errors.length) { console.log(errors.join('\n')); process.exitCode = 1; }
