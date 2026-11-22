import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { staticCollision } from '../../src/assets/staticCollision';
import { worldAssets } from '../../src/assets/worldDefinitions';
import { levelTenLayouts, markL10Solids } from '../../src/levels/L10/layout';
import { levelEightLayouts } from '../../src/levels/L8/layout';
import { districtDecor } from '../../src/levels/decor';
import { applyFarmLandscape } from '../../src/levels/L10/farmLayout';
import { placementColliders } from '../../src/levels/districts/staticCollision';
import type { DistrictLayout, Placement } from '../../src/levels/districts/types';

type Row = { level: string; rendered: number; before: number; after: number; beforeTop: [string, number][]; remainingTop: [string, number][] };
const eligible = (p: Placement) => {
  const d = worldAssets[p.assetId]?.dimensions;
  if (!d || d.x * d.z * Math.abs(p.scale[0] * p.scale[2]) < .4 || d.y * Math.abs(p.scale[1]) < .5) return false;
  const boxes = staticCollision[p.collisionId ?? '']?.boxes ?? staticCollision[p.assetId]?.boxes ?? [];
  return !!worldAssets[p.assetId]?.world?.solid || boxes.some(b => b.max[1] - b.min[1] >= .5 && b.max[1] >= .5);
};
const summarize = (items: string[]): [string, number][] => Object.entries(items.reduce<Record<string, number>>((out, id) => {
  const type = id.split(':')[0]; out[type] = (out[type] ?? 0) + 1; return out;
}, {})).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8);
const layouts = readdirSync('public/assets/layouts').filter(path => path.endsWith('.layout.json')).sort().map(path =>
  JSON.parse(readFileSync(`public/assets/layouts/${path}`, 'utf8')) as DistrictLayout);
const rows: Row[] = layouts.map(source => {
  const layout = source.district === 'D-CURE' ? levelTenLayouts([source])[0]
    : source.district === 'D-ZOO' ? levelEightLayouts([source])[0] : source;
  if (source.district === 'D-CURE') {
    layout.placements.push(...districtDecor('D-CURE', layout.placements));
    applyFarmLandscape(layout);
    markL10Solids(layout.placements);
  }
  const targets = layout.placements.filter(eligible), afterColliders = placementColliders(layout.placements, layout.colliders);
  const canBlock = afterColliders.filter(c => !c.aabb.physicsOnly);
  const beforeBad: string[] = [], afterBad: string[] = [];
  for (const p of targets) {
    const liveTiers = [0, 1, 2, 3, 4, 5, 6].filter(t => t >= p.minTier && t <= p.maxTier);
    if (!liveTiers.length) continue;
    const oldShape = staticCollision[p.collisionId ?? ''] ?? staticCollision[p.assetId];
    const oldHasGeometry = !(p.decor && !p.decorSolid) && !!oldShape?.boxes.length;
    const authoredHasGeometry = layout.colliders.some(c => c.id === p.id || c.id.startsWith(`${p.id}/`));
    if (!oldHasGeometry && !authoredHasGeometry || p.decorSolid) beforeBad.push(`${p.assetId}:${p.id}`);
    if (!liveTiers.every(t => canBlock.some(c => (c.id === p.id || c.id.startsWith(`${p.id}/`)) && c.minTier <= t && c.maxTier >= t))) afterBad.push(`${p.assetId}:${p.id}`);
  }
  return { level: source.district, rendered: layout.placements.length, before: beforeBad.length, after: afterBad.length, beforeTop: summarize(beforeBad), remainingTop: summarize(afterBad) };
});
const report = { threshold: { footprintM2: .4, heightM: .5 }, levels: rows, totals: { before: rows.reduce((n, r) => n + r.before, 0), after: rows.reduce((n, r) => n + r.after, 0) } };
const outputIndex = process.argv.indexOf('--out');
if (outputIndex >= 0 && !process.argv[outputIndex + 1]) throw new Error('--out requires a file path');
const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : 'docs/reports/s211c-solids/audit.json';
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
