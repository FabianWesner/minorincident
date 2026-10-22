import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { compositions } from '../../../src/levels/compositions';
import { highwayPoint } from '../../../src/levels/L3/highway';
import type { DistrictLayout, Placement } from '../../../src/levels/districts/types';
import { SimWorld } from '../../../src/sim/world/SimWorld';

/**
 * PO P1-113 (L3 army checkpoint, "Fix the gap in the road"): each 0.2 m ramp strip was one axis-aligned box over the whole 4.62 m
 * deck width. On the S-curve that box is ~3.5 m wide in x, so the courier stood on a phantom slab up to 1 m above the drawn road
 * and the real deck beside her read as a dark void. Guard: across both L3 ramps the walkable height at every deck sample equals
 * the drawn deck (highwayPoint) within 20 cm, and outside the rails it is the ground, never a raised phantom support.
 */
test('@E21 L3 highway ramps: walkable height follows the drawn deck, no phantom support beside it', async () => {
  const layout = JSON.parse(readFileSync('public/assets/layouts/D-CORRIDOR.layout.json', 'utf8')) as DistrictLayout;
  const w = new SimWorld(); await w.init(); w.loadComposition(compositions.L3, [layout], 1);
  const d = w.districts!, bad: string[] = [];
  const ramps = d.districts[0].layout.placements.filter((p: Placement) => p.assetId === 'kit.highway-onramp');
  expect(ramps.length).toBe(2);
  for (const p of ramps) for (let i = 0; i <= 96; i++) {
    const t = i / 96;
    for (const o of [-2.2, -1.1, 0, 1.1, 2.2]) {
      const [x, y, z] = highwayPoint(p, t, o), h = d.groundHeight(x, z);
      if (Math.abs(h - y) > .2) bad.push(`deck ${p.id} t=${t.toFixed(2)} o=${o} (${x.toFixed(2)}, ${z.toFixed(2)}) walk ${h.toFixed(2)} drawn ${y.toFixed(2)}`);
    }
    // Beyond the rail (offset 3.3-4.5) the ground may rise only to the ramp's own foot lip, never to deck height.
    for (const o of [-4.5, -3.3, 3.3, 4.5]) {
      const [x, y, z] = highwayPoint(p, t, o), h = d.groundHeight(x, z);
      if (t > .06 && y > 1 && h > 1 && h > y - 1) bad.push(`phantom ${p.id} t=${t.toFixed(2)} o=${o} (${x.toFixed(2)}, ${z.toFixed(2)}) walk ${h.toFixed(2)} deck ${y.toFixed(2)}`);
    }
  }
  // The wedge beside each joint rail (road end tilted against the square span) is drawn and walkable at deck height.
  for (const [x, z] of [[180.25, -.95], [166.75, .95], [180.9, -.5], [166.1, .5]]) if (Math.abs(d.groundHeight(x, z) - 5.7) > .1) bad.push(`wedge (${x}, ${z}) walk ${d.groundHeight(x, z).toFixed(2)}`);
  expect(bad.slice(0, 12), `${bad.length} offenders`).toEqual([]);
}, 120_000);
