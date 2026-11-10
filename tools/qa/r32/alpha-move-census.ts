/** r32-alphas: which Alpha types each level spawns and which special moves each type actually starts in a played run.
 * node --import tsx/esm tools/qa/r32/alpha-move-census.ts [out.json] [seconds] [levels,comma] [policy] [seed]
 * Counts every new specialAttack (by attackId) per `alphaType|move`, every ordinary Alpha strike per type and the Alpha
 * population per type. A move that belongs to another type is reported under `foreign` (must stay 0). */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { runLevel } from '../../sim-runner/levels';
import { alphaTypes, type AlphaType } from '../../../src/data/alphaTypes';

const out = process.argv[2] ?? 'test-results/r32-alpha-moves.json', cap = Number(process.argv[3] ?? 900);
const levels = (process.argv[4] ?? 'L3,L4,L5,L6,L7,L9,L10').split(',');
const policy = (process.argv[5] ?? 'complete') as Parameters<typeof runLevel>[1], seed = Number(process.argv[6] ?? 1);
type Row = { alphas: Record<string, number>; moves: Record<string, number>; strikes: Record<string, number>; foreign: number; looks: Record<string, number> };
const rows: Record<string, Row> = {};
mkdirSync(dirname(out), { recursive: true });
let current = '';
const seenAlpha = new Set<number>(), seenAttack = new Set<number>(), lastAttack = new Map<number, number>();
const update = SimWorld.prototype.update;
SimWorld.prototype.update = function (this: SimWorld, ...args: Parameters<SimWorld['update']>) {
  const r = update.apply(this, args);
  const row = rows[current] ??= { alphas: {}, moves: {}, strikes: {}, foreign: 0, looks: {} };
  for (const e of this.entities.iterate()) {
    if (e.archetype !== 'infected.alpha' || !e.infected || e.corpse || e.health.current <= 0) continue;
    const b = e.infected, type = (b.alphaType ?? (b.pursuit ? 'mega' : 'untyped')) as AlphaType | 'mega' | 'untyped';
    if (!seenAlpha.has(e.id)) { seenAlpha.add(e.id); row.alphas[type] = (row.alphas[type] ?? 0) + 1; const look = b.model ?? b.variant ?? '-'; row.looks[`${type}:${look}`] = (row.looks[`${type}:${look}`] ?? 0) + 1; }
    const a = b.specialAttack;
    if (a && !seenAttack.has(a.attackId)) {
      seenAttack.add(a.attackId);
      row.moves[`${type}|${a.move}`] = (row.moves[`${type}|${a.move}`] ?? 0) + 1;
      if (type in alphaTypes && !b.pursuit && !alphaTypes[type as AlphaType].moves.includes(a.move)) row.foreign++;
    }
    if (b.state === 'attack' && lastAttack.get(e.id) !== b.attackId) { lastAttack.set(e.id, b.attackId); row.strikes[type] = (row.strikes[type] ?? 0) + 1; }
  }
  return r;
};
for (const level of levels) {
  current = level; seenAlpha.clear(); seenAttack.clear(); lastAttack.clear();
  const t = Date.now();
  const rep = await runLevel(level as Parameters<typeof runLevel>[0], policy, seed, cap);
  console.log(level, rep.outcome, Math.round(rep.time), 's sim', ((Date.now() - t) / 1000).toFixed(0), 's wall', JSON.stringify(rows[level] ?? {}));
  writeFileSync(out, JSON.stringify(rows, null, 1));
}
process.exit(0);
