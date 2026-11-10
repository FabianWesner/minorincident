/** r31-zombie-audit: which infected identities each level actually spawns (archetype x drawn asset x alpha type x render path).
 * node --import tsx tools/qa/r31/zombie-census.ts [out.json] [seconds] [levels,comma]  (complete policy, seed 1) */
import { writeFileSync } from 'node:fs';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { runLevel } from '../../sim-runner/levels';
import { keepsLook } from '../../../src/sim/outbreak/appearance';

const out = process.argv[2] ?? 'test-results/r31-census.json', cap = Number(process.argv[3] ?? 900);
const levels = (process.argv[4] ?? 'L1,L2,L3,L4,L5,L6,L7,L8,L9,L10').split(',');
const rows: Record<string, Record<string, number>> = {};
let current = '';
const update = SimWorld.prototype.update;
const seen = new Set<string>();
SimWorld.prototype.update = function (this: SimWorld, ...args: Parameters<SimWorld['update']>) {
  const r = update.apply(this, args);
  if (this.tick % 30 === 0) for (const e of this.entities.iterate()) {
    if (!e.infected || e.corpse) continue;
    const key = `${current}:${e.id}`; if (seen.has(key)) continue; seen.add(key);
    const asset = e.appearance?.asset ?? e.infected.model ?? e.infected.variant ?? '-';
    const path = keepsLook(e) && e.appearance?.asset !== 'inf.common-worker' ? 'civ' : 'crowd';
    const id = `${e.archetype}|${asset}|${(e.infected as { alphaType?: string }).alphaType ?? ''}|${path}`;
    (rows[current] ??= {})[id] = (rows[current][id] ?? 0) + 1;
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
