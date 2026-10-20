import { afterEach, expect, test } from 'vitest';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { loadL4 } from '../../tools/sim-runner/l4Bots';

/**
 * PO #41 (Opus visual QA 10-19): "L4 tick 7108-9654, player (-32.48, 13.30-14.18), WebGPU: collision pocket between the yellow generator
 * trailer, sandbag pallets and the first tent - after walking in with A, S or D held 240 ticks do not move her."
 * The gap between the west pallet run and the first reception tent was 0.7 m, exactly a courier wide, and ended at the light tower: a dead-end
 * alley that wedges her. Nobody can enter it any more, and the tower still seals the line corner.
 */
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });

test('T-E22-po-41 @E22 no courier-sized dead-end alley remains between the west pallet run, the first tent and the light tower', async () => {
  const l = await loadL4(1); world = l.world;
  const nav = world.infected!.nav, open: string[] = [];
  for (let z = 11.2; z <= 14.4; z += .2) for (let x = -33.2; x <= -31; x += .1) if (nav.clear(x, z, .35)) open.push(`${x.toFixed(1)},${z.toFixed(1)}`);
  expect(open, 'free courier positions in the old pocket').toEqual([]);
  expect(nav.clear(-32.48, 13.7, .35)).toBe(false);
  // The corridor north of the tent (the registration queue side) and the outside of the line stay walkable.
  expect(nav.clear(-31.0, 10, .35)).toBe(true);
  expect(nav.clear(-35, 13, .35)).toBe(true);
});
