import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import type { DistrictLayout } from '../../../src/levels/districts/types';
import { floorAt, layoutHouseDoors } from '../../../src/sim/outbreak/HouseEmergence';

/** PO P1 10-08 "a zombie spawning out of nowhere": the beat-9 residents come out of a real front door. */
describe('HouseEmergence door geometry', () => {
  const layout = JSON.parse(readFileSync('public/assets/layouts/D-GROVE.layout.json', 'utf8')) as DistrictLayout;
  const anchors = Object.fromEntries(Object.entries(layout.anchors).map(([k, a]) => [k, { x: (a as { position: number[] }).position[0], z: (a as { position: number[] }).position[2] }]));
  test('every house-a front door sits behind its gate path, faces the street and matches its refuge door', () => {
    const doors = layoutHouseDoors(layout, [0, 0], anchors);
    expect(doors.length).toBe(layout.placements.filter(p => p.assetId === 'bld.house-a').length);
    for (const d of doors) {
      const p = layout.placements.find(q => q.id === d.house)!;
      // Front normal = the model's +X (layout yaw), the threshold inside the house footprint's front half, on the gate line.
      expect(d.nx).toBeCloseTo(Math.cos(p.yaw), 5); expect(d.nz).toBeCloseTo(-Math.sin(p.yaw), 5);
      expect(d.door).toBeGreaterThan(0);
      const gate = anchors[`refuge-door-${d.door}`], along = (gate.x - d.x) * d.nx + (gate.z - d.z) * d.nz, lateral = (gate.x - d.x) * d.nz - (gate.z - d.z) * d.nx;
      expect(Math.abs(lateral)).toBeLessThan(.05); expect(along).toBeGreaterThan(d.depth); expect(along).toBeLessThan(d.depth + 1.5);
    }
  });
  test('porch floor: deck, two treads, then the path', () => {
    const door = { floor: [[1.59, .54], [1.85, .36], [2.11, .2]] as [number, number][] };
    expect(floorAt(door, -.9)).toBe(.54); expect(floorAt(door, 1)).toBe(.54); expect(floorAt(door, 1.7)).toBe(.36);
    expect(floorAt(door, 2)).toBe(.2); expect(floorAt(door, 2.5)).toBe(0);
    // Eased over 10 cm at a tread edge, monotonic.
    expect(floorAt(door, 1.59)).toBeCloseTo(.45, 5);
    for (let s = -1; s < 3; s += .01) expect(floorAt(door, s + .01)).toBeLessThanOrEqual(floorAt(door, s) + 1e-9);
  });
});
