/** r33-heavies: in-level census of the heavy roles. For every infected entity of a seeded complete run it records the archetype,
 * the asset the crowd draws it with (infectedDef(archetype).asset, the same selection CrowdView uses) and whether that asset is a
 * skinned crowd look (manifest crowdSkin) or would fall back to the runner batch.
 * node --import tsx tools/qa/r33/heavy-census.ts <out.json> [seconds] [levels,comma] */
import { readFileSync, writeFileSync } from 'node:fs';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { runLevel } from '../../sim-runner/levels';
import { infectedDef } from '../../../src/data/infected';
import type { AssetDef } from '../../../src/assets/types';

const out = process.argv[2] ?? 'test-results/r33-census.json', cap = Number(process.argv[3] ?? 900);
const levels = (process.argv[4] ?? 'L4,L5').split(',');
const manifest = new Map((JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as AssetDef[]).map(a => [a.id, a]));
const rows: Record<string, Record<string, { n: number; asset: string; ownSkinned: boolean }>> = {};
const seen = new Set<string>();
let current = '';
const update = SimWorld.prototype.update;
SimWorld.prototype.update = function (this: SimWorld, ...args: Parameters<SimWorld['update']>) {
  const r = update.apply(this, args);
  if (this.tick % 30 === 0) for (const e of this.entities.iterate()) {
    if (!e.infected || e.corpse || !e.archetype?.startsWith('infected.')) continue;
    const key = `${current}:${e.id}`; if (seen.has(key)) continue; seen.add(key);
    let asset = '-'; try { asset = e.infected.model ?? infectedDef(e.archetype).asset; } catch { /* animal / story archetype */ }
    const def = manifest.get(asset);
    const row = ((rows[current] ??= {})[e.archetype] ??= { n: 0, asset, ownSkinned: !!def?.crowdSkin });
    row.n++;
  }
  return r;
};
for (const level of levels) {
  current = level;
  const t = Date.now();
  const rep = await runLevel(level as Parameters<typeof runLevel>[0], 'complete', 1, cap);
  console.log(level, rep.outcome, Math.round(rep.time), 's sim', ((Date.now() - t) / 1000).toFixed(0), 's wall', JSON.stringify(rows[level] ?? {}));
  writeFileSync(out, JSON.stringify(rows, null, 1));
}
process.exit(0);
