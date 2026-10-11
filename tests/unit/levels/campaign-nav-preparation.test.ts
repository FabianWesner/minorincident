import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { compositions } from '../../../src/levels/compositions';
import { missionIds } from '../../../src/levels/missions';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { stateHash } from '../../../src/sim/world/stateHash';
import type { NavGrid } from '../../../src/sim/ai/NavGrid';
import type { ScenarioDefinition } from '../../../src/levels/loader';

const mode = vi.hoisted(() => ({ previous: false }));
vi.mock('../../../src/sim/ai/InfectedSystem', async importOriginal => {
  const module = await importOriginal<typeof import('../../../src/sim/ai/InfectedSystem')>();
  return { ...module, InfectedSystem: class extends module.InfectedSystem {
    constructor(world: SimWorld, definition: ScenarioDefinition, mask: NavGrid['mask'] = null) {
      super(world, definition, mode.previous ? null : mask);
      // Original campaign construction installed this mask after the constructors
      // (which perform no navigation queries), then rebaked with live blockers.
      if (mode.previous && mask) { this.nav.mask = mask; this.nav.rebake(); }
    }
  } };
});

for (const id of missionIds) test(`${id}: one campaign navigation bake matches the previous mask/rebake path`, async () => {
  const run = async (previous: boolean) => {
    mode.previous = previous;
    const world = new SimWorld(); await world.init();
    try {
      const composition = compositions[id];
      world.loadComposition(composition, composition.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), 1);
      const nav = world.infected!.nav, player = world.entities.get(1)!.transform;
      const hash = stateHash(world.getState()), blocked = Buffer.from(nav.blocked);
      const target = nav.nearestCell(player.x, player.z);
      nav.flow(nav.x(target), nav.z(target), nav.blocked.length);
      return { hash, blocked, target, distance: Buffer.from(nav.distance.buffer) };
    } finally { world.dispose(); mode.previous = false; }
  };
  const actual = await run(false), previous = await run(true);
  expect(actual.hash).toBe(previous.hash); expect(actual.target).toBe(previous.target);
  expect(actual.blocked.equals(previous.blocked)).toBe(true);
  expect(actual.distance.equals(previous.distance)).toBe(true);
}, 120_000);
