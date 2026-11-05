import { readFileSync } from 'node:fs';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { loadLayouts } from '../../src/levels/layouts';
import { resolveCampaignMission } from '../../src/levels/missions';
import { NavGrid as WorldNav } from '../../src/sim/world/NavGrid';
import { NavGrid as ActorNav } from '../../src/sim/ai/NavGrid';
import type { MissionId } from '../../src/levels/missions';

// Separate CPU construction from browser shader/asset costs; --begin also measures mission setup.
const spans = new Map<string, { calls: number; ms: number }>();
function wrap<T extends object, K extends keyof T>(object: T, key: K): void {
  const original = object[key] as (...args: unknown[]) => unknown;
  object[key] = function (this: T, ...args: unknown[]) {
    const start = performance.now();
    try { return original.apply(this, args); }
    finally { const name = `${object.constructor.name}.${String(key)}`, s = spans.get(name) ?? { calls: 0, ms: 0 }; s.calls++; s.ms += performance.now() - start; spans.set(name, s); }
  } as T[K];
}
wrap(WorldNav.prototype, 'block'); wrap(WorldNav.prototype, 'unblock'); wrap(WorldNav.prototype, 'flood');
wrap(ActorNav.prototype, 'rebake'); wrap(ActorNav.prototype, 'reachableFrom');
const world = new SimWorld(); await world.init();
for (const id of ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'] as MissionId[]) {
  spans.clear();
  const { composition, layouts } = await loadLayouts(id, undefined, async url => JSON.parse(readFileSync(`public${url}`, 'utf8')));
  const start = performance.now(); world.loadComposition(composition, layouts, 1);
  if (process.argv.includes('--low')) world.npcs?.setQuality('low');
  const sim = performance.now(); world.loadMission(resolveCampaignMission(id, world.districts!));
  const mission = performance.now(); if (process.argv.includes('--begin')) world.missions!.begin();
  console.log(JSON.stringify({ id, compositionMs: sim - start, missionMs: mission - sim, beginMs: performance.now() - mission, spans: Object.fromEntries(spans) }));
  world.reset();
}
world.dispose();
