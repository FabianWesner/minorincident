import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadLevel } from '../../sim-runner/levels';
import { LevelNineBot } from '../../../src/debug/bot/LevelNineBot';
import { l9Groups } from '../../../src/data/l9';
import type { Point } from '../../../src/levels/districts/types';
import { preset } from '../../../src/sim/progression/Campaign';
import { stateHash } from '../../../src/sim/world/stateHash';
import { provenance, type Tier } from './probe';
import { atomicJson } from './report';

const routes = ['road', 'countryside', 'dry-shortcut'] as const;
const authored = l9Groups.filter(group => !group.id.includes('wanderer'));
async function drive(tier: Tier, route: typeof routes[number], observe: boolean) {
  const campaign = preset('L9-default'); campaign.settings.quality = tier;
  const world = await loadLevel('L9', 1, campaign, 0, { quality: tier });
  const groups: { id: string; route: string; tick: number; expectedCount: number; ids: number[]; actors: { id: number; archetype: string; hp: number; x: number; z: number }[] }[] = [];
  const detourClearance = new Map(authored.filter(group => group.route === route).map(group => [group.id, Infinity]));
  const closestToSegment = (point: Point, a: { x: number; z: number }, b: { x: number; z: number }) => {
    const dx = b.x - a.x, dz = b.z - a.z, length2 = dx * dx + dz * dz;
    const t = length2 ? Math.max(0, Math.min(1, ((point[0] - a.x) * dx + (point[1] - a.z) * dz) / length2)) : 0;
    return Math.hypot(point[0] - (a.x + dx * t), point[1] - (a.z + dz * t));
  };
  try {
    const bot = new LevelNineBot(world, route, true);
    const carId = world.missions!.l9!.state.carId;
    const initial = world.entities.get(carId)!.transform;
    let previous = { x: initial.x, z: initial.z };
    for (let i = 0; i < 1200 * 60 && !bot.finished; i++) {
      world.applyInput(bot.sample(), 'keyboard'); world.update();
      const car = world.entities.get(world.missions!.l9!.state.carId)!;
      for (const group of authored.filter(group => group.route === route)) {
        detourClearance.set(group.id, Math.min(detourClearance.get(group.id)!, closestToSegment(group.at, previous, car.transform)));
      }
      previous = { x: car.transform.x, z: car.transform.z };
      if (!observe || world.tick % 10) continue;
      const encounters = world.missions!.l9!.state.encounters!;
      for (const group of authored) {
        if (group.route !== route || groups.some(row => row.id === group.id) || !encounters.spawned.includes(group.id)) continue;
        const ids = [...encounters.ids[group.id]];
        const actors = ids.map(id => {
          const actor = world.entities.get(id); assert(actor, `newly admitted group actor ${id} must exist`);
          return { id, archetype: actor.archetype, hp: actor.health.current, x: actor.transform.x, z: actor.transform.z };
        });
        groups.push({ id: group.id, route: group.route, tick: world.tick, expectedCount: group.route === 'dry-shortcut' ? 8 : 6, ids, actors });
      }
    }
    return { tier, route, finished: bot.finished, finalHash: stateHash(world.getState()), groups,
      detours: [...detourClearance].map(([id, minimumDriveClearance]) => ({ id, route, minimumDriveClearance })) };
  } finally { world.dispose(); }
}
const cells: (Awaited<ReturnType<typeof drive>> & { controlHash: string; controlIdentical: boolean })[] = [];
for (const tier of ['low', 'high'] as const) for (const route of routes) {
  const observed = await drive(tier, route, true), control = await drive(tier, route, false);
  assert.equal(observed.finalHash, control.finalHash, 'census must preserve independent native route state');
  assert.equal(observed.finished, control.finished);
  cells.push({ ...observed, controlHash: control.finalHash, controlIdentical: true });
  console.log(tier, route, { finished: observed.finished, groups: observed.groups.length, controlIdentical: true });
}
const rows = (['low', 'high'] as const).map(tier => {
  const groups = authored.map(group => {
    const found = cells.filter(cell => cell.tier === tier).flatMap(cell => cell.groups).find(row => row.id === group.id);
    if (!found) return { id: group.id, route: group.route, status: 'NOT CHECKED', actualCount: null, expectedCount: group.route === 'dry-shortcut' ? 8 : 6, runners: null, alphas: null };
    const runners = found.actors.filter(actor => actor.archetype === 'infected.runner').length;
    const alphas = found.actors.filter(actor => actor.archetype === 'infected.alpha').length;
    return { ...found, runners, alphas, actualCount: found.ids.length,
      status: found.ids.length === found.expectedCount && new Set(found.ids).size === found.ids.length ? 'PASS' : 'FAIL' };
  });
  const detours = cells.filter(cell => cell.tier === tier).flatMap(cell => cell.detours);
  return { tier, groups, detours, shortcutAlphas: groups.filter(group => group.route === 'dry-shortcut').reduce((n, group) => n + (group.alphas ?? 0), 0),
    failures: groups.filter(group => group.status === 'FAIL').map(group => ({ id: group.id, expectedCount: group.expectedCount, actualCount: group.actualCount })) };
});
atomicJson('docs/reports/sweep-c/L9-02-census.json', { ...provenance(),
  toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
  criterion: 'Groups on routes: road 2 × 6, countryside 3 × 6, shortcut 6 × 8 incl. 2 Alphas; each avoidable by a detour ≥ 20 m.',
  method: 'Actual first complete resident admissions on ordinary native routes at both qualities, seed1. Observe production encounter IDs and real entity archetypes, not authored runner counts alone. Repeat every route without the observer and require equal final states. No population, timer, cap or actor writes. This census measures counts/composition; physical detour qualification is separate.',
  cells, rows });
console.log(rows.map(row => ({ tier: row.tier, failures: row.failures, shortcutAlphas: row.shortcutAlphas })));
