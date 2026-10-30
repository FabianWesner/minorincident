/** Measure batch-40, pre-rollout main, and q257 figure heights in their runtime frames. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { assetIO } from '../assets/io';
import { measureFigure } from '../assets/figure-proportions';
import { civilianHeight } from '../../src/render/npc/figureHeight';

const batch40 = 'fd8f56ca3';
const main = '4698e5aa0';
const original = (revision: string, path: string) => execFileSync('git', ['show', `${revision}:${path}`], { maxBuffer: 64 * 1024 * 1024 });
const census = JSON.parse(readFileSync('docs/reports/q249/rollout/census.json', 'utf8')) as { rows: { id: string; path: string; rootName?: string; child?: boolean; error?: string }[] };
const io = await assetIO();
const fittedNpcModels = new Set([
  'npc.civilian-adult-m', 'npc.civilian-adult-f', 'npc.civilian-kid', 'npc.civilian-elderly', 'npc.brother',
  'npc.civilian-man-a', 'npc.civilian-man-b', 'npc.civilian-woman-a', 'npc.civilian-woman-b',
  'npc.lab-tech-a', 'npc.lab-tech-b', 'npc.lab-guard', 'npc.depot-clerk', 'npc.firefighter-alive',
  'npc.police-officer', 'npc.paramedic', 'npc.national-guard', 'npc.helicopter-pilot',
  'npc.dale.aftermath', 'npc.rosa.aftermath', 'npc.mr-okafor.aftermath', 'npc.mia.aftermath', 'npc.sam.aftermath',
  'npc.civilian-man-a.aftermath', 'npc.civilian-man-b.aftermath', 'npc.civilian-woman-b.aftermath',
  'npc.marcus.aftermath', 'npc.shelter-survivor.bandaged', 'npc.shelter-survivor.lying', 'npc.shelter-survivor.sitting',
]);
const oldFit = (height: number, id: string) => {
  if (!fittedNpcModels.has(id)) return height;
  const target = id === 'npc.civilian-kid' ? 1.4744 : id === 'npc.brother' ? 1.4265 : 1.8;
  return height > 0 && Math.abs(height / target - 1) > .08 ? target : height;
};
const newFit = (height: number, id: string) => {
  if (fittedNpcModels.has(id)) return civilianHeight(id);
  if (id === 'char.survivor-female') return civilianHeight('npc.civilian-woman-a');
  if (['char.courier-male', 'char.survivor-male'].includes(id)) return civilianHeight('npc.civilian-man-a');
  return height;
};
const rows: { id: string; root?: string; prod: number; main: number; after: number }[] = [];
for (const row of census.rows.filter(r => !r.error)) {
  let path = row.path;
  if (row.id === 'char.courier-male') path = 'public/assets/models/char.courier-male.skin.glb';
  const measure = async (revision: string) => {
    const doc = await io.readBinary(original(revision, path));
    return measureFigure(doc, row.rootName).height;
  };
  const prodRaw = await measure(batch40), mainRaw = await measure(main);
  const afterRaw = measureFigure(await io.read(path), row.rootName).height;
  rows.push({ id: row.id, ...(row.rootName ? { root: row.rootName } : {}), prod: oldFit(prodRaw, row.id), main: oldFit(mainRaw, row.id), after: newFit(afterRaw, row.id) });
}
const heroine = measureFigure(await io.read('public/assets/models/char.courier-female.skin.glb')).height;
rows.unshift({ id: 'Heroine', prod: heroine, main: heroine, after: heroine });
const fmt = (n: number) => n.toFixed(3);
const markdown = [
  '# q257 height census', '',
  `Measured mesh/bind-pose heights after the historical load-time normalizer, or the q257 target fitter. Heroine: ${fmt(heroine)} m; adult women: ${fmt(civilianHeight('npc.civilian-woman-a'))} m; adult men: ${fmt(civilianHeight('npc.civilian-man-a'))} m; elderly man: ${fmt(civilianHeight('npc.civilian-elderly'))} m.`,
  '“PROD batch 40” reads commit `fd8f56ca3`; “main” reads original q249 baseline `4698e5aa0`; “after” reads the current worktree. Each row is an in-game asset figure; survivor-group rows identify the member root.', '',
  '| Figure | PROD batch 40 (m) | main (m) | after (m) |', '|---|---:|---:|---:|',
  ...rows.map(r => `| ${r.id}${r.root ? ` / ${r.root}` : ''} | ${fmt(r.prod)} | ${fmt(r.main)} | ${fmt(r.after)} |`), ''
].join('\n');
mkdirSync('docs/reports/q257', { recursive: true });
writeFileSync('docs/reports/q257/height-census.json', JSON.stringify({ batch40, main, heroine, rows }, null, 2) + '\n');
writeFileSync('docs/reports/q257/height-census.md', markdown);
console.log(`wrote ${rows.length} figures; heroine ${fmt(heroine)} m; women ${fmt(civilianHeight('npc.civilian-woman-a'))} m; men ${fmt(civilianHeight('npc.civilian-man-a'))} m`);
