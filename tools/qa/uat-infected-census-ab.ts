/** Native runner census using each checkout's own simulation and combat modules.
 * node --import tsx tools/qa/uat-infected-census-ab.ts <prod-worktree> */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { SimWorld } from '../../src/sim/world/SimWorld';

const root = process.cwd(), prod = process.argv[2];
if (!prod) throw new Error('PROD worktree required');
const results: Record<string, unknown> = {};
for (const [side, directory] of [['prod', resolve(prod)], ['current', root]]) {
  process.chdir(directory);
  const { SimWorld: World } = await import(pathToFileURL(resolve(directory, 'src/sim/world/SimWorld.ts')).href);
  const { runLevel } = await import(pathToFileURL(resolve(directory, 'tools/sim-runner/levels.ts')).href);
  const update = World.prototype.update, worlds = new WeakMap<object, { seen: Map<number, string>; kills: number; attacks: number; damage: number; samples: Record<string, unknown> }>();
  const rows: Record<string, unknown> = {};
  World.prototype.update = function(this: SimWorld) {
    let state = worlds.get(this);
    if (!state) {
      state = { seen: new Map(), kills: 0, attacks: 0, damage: 0, samples: {} }; worlds.set(this, state);
      rows[this.scenario!] = { samples: state.samples };
      this.events.on('combat.kill', () => { state!.kills++; });
      this.events.on('infected.attack', e => { if (e.type === 'infected.attack' && e.targetId === 1) { state!.attacks++; state!.damage += e.amount; } });
    }
    update.call(this);
    for (const e of this.entities.iterate()) if (e.infected) state.seen.set(e.id, e.archetype);
    const seconds = this.tick / 60;
    if ([34, 60].includes(seconds)) {
      const live = [...this.entities.iterate()].filter(e => e.infected && e.health.current > 0 && !e.hidden && !e.infected.hidden);
      state.samples[seconds] = { spawned: state.seen.size, alphaSpawned: [...state.seen.values()].filter(a => a === 'infected.alpha').length, alive: live.length, alphaAlive: live.filter(e => e.archetype === 'infected.alpha').length, kills: state.kills, courierAttacks: state.attacks, courierDamage: state.damage };
    }
  };
  try {
    for (const level of ['L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10']) {
      const report = await runLevel(level, 'complete', 1, level === 'L6' ? 360 : 60);
      const row = rows[level] as { report?: unknown };
      row.report = { time: report.time, kills: report.kills, damage: report.damageTaken, deaths: report.deaths, outcome: report.outcome };
      console.log(side, level, JSON.stringify(row));
    }
  } finally { World.prototype.update = update; }
  results[side] = rows;
}
process.chdir(root);
writeFileSync('test-results/q297/native-census-ab.json', JSON.stringify(results, null, 2));
