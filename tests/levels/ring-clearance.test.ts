import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, test } from 'vitest';
import { levelTwoLayouts, RING_CLEAR_M } from '../../src/levels/L2/layout';
import type { DistrictLayout } from '../../src/levels/districts/types';
import type { Mission } from '../../src/sim/missions/Mission';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { loadL1 } from '../../tools/sim-runner/l1Bots';
import { loadL2 } from '../../tools/sim-runner/l2Bots';

/** PO 10-08: interaction rings are keep-out zones for props (a hydrant beside the L2 boarding ring made it hard to enter). */
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
const grove = (): DistrictLayout => JSON.parse(readFileSync('public/assets/layouts/D-GROVE.layout.json', 'utf8'));

/** Every stand-to-interact ring of the mission, as [step, x, z, radius]. */
function rings(m: Mission): [string, number, number, number][] {
  return m.def.steps.filter(s => s.complete.kind === 'interact').map(s => { const a = m.def.anchors[(s.complete as { anchor: string }).anchor]; return [s.id, a.x, a.z, Math.min(a.radius, 2)]; });
}
/** Loose prop colliders (not buildings, fences or the ground) closer than ring + clearance. */
function blockers(layout: DistrictLayout, ring: [string, number, number, number], clear: number): string[] {
  return layout.colliders.filter(c => !c.id.startsWith('bld.') && !c.id.includes('fence') && !c.id.startsWith('kit.')).filter(c => {
    const [x0, , z0] = c.aabb.min, [x1, , z1] = c.aabb.max, dx = Math.max(x0 - ring[1], 0, ring[1] - x1), dz = Math.max(z0 - ring[2], 0, ring[2] - z1);
    return Math.hypot(dx, dz) < ring[3] + clear;
  }).map(c => `${c.id}@${ring[0]}`);
}

describe('interaction rings are prop-free', () => {
  test('L2 (all rings, 1.2 m around each ring)', async () => {
    const l = await loadL2(1); world = l.world;
    const layout = levelTwoLayouts([grove()]).find(d => d.district === 'D-GROVE')!;
    expect(layout.placements.some(p => p.id === 'prop.fire-hydrant:857')).toBe(false); // the hydrant by the boarding approach
    expect(layout.colliders.some(c => c.id === 'prop.fire-hydrant:857')).toBe(false);
    expect(rings(l.mission).length).toBeGreaterThanOrEqual(2);
    expect(rings(l.mission).flatMap(r => blockers(layout, r, RING_CLEAR_M))).toEqual([]);
  });
  test('L1 (all rings, 1.2 m around each ring)', async () => {
    const l = await loadL1(1); world = l.world;
    expect(rings(l.mission).length).toBeGreaterThanOrEqual(2);
    expect(rings(l.mission).flatMap(r => blockers(grove(), r, RING_CLEAR_M))).toEqual([]);
  });
});
