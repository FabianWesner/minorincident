import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cureCrossingLines, cureCrossingStories } from '../../src/levels/L10/crossingStories';
import { cureRoadsideBelt } from '../../src/levels/L10/roadsideBelt';
import { cure } from '../../src/levels/L10/district';
import { cureEncounters, cureEncounterSlots } from '../../src/levels/L10/encounters';
import { districtDecor } from '../../src/levels/decor';
import { placementColliders } from '../../src/levels/districts/staticCollision';
import { compositions } from '../../src/levels/compositions';
import { DistrictWorld } from '../../src/sim/world/DistrictWorld';
import type { DistrictLayout, Point } from '../../src/levels/districts/types';

const layout = JSON.parse(readFileSync('public/assets/layouts/D-CURE.layout.json', 'utf8')) as DistrictLayout;
const belt = cureRoadsideBelt(layout.placements);
const stories = cureCrossingStories([...layout.placements, ...belt]);
const seg = (p: Point, a: Point, b: Point) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], d = dx * dx + dz * dz, t = d ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / d)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
};
const lineDistance = (p: Point, line: readonly Point[]) => Math.min(...line.slice(1).map((b, i) => seg(p, line[i], b)));
const corners = (a: { min: number[]; max: number[] }): Point[] => [[a.min[0], a.min[2]], [a.min[0], a.max[2]], [a.max[0], a.min[2]], [a.max[0], a.max[2]]];

describe('L10 crossing stories (r9-l10pace, vqa58 "minutes of empty dark grass")', () => {
  it('dresses every measured crossing with lit scenes, deterministically', () => {
    expect(cureCrossingStories([...layout.placements, ...belt])).toEqual(stories);
    for (const li of cureCrossingLines.keys()) expect(stories.filter(p => p.id.startsWith(`decor-cure-cross-${li}-`) && p.fieldLight).length).toBeGreaterThanOrEqual(1);
    expect(stories.filter(p => p.fieldLight).length).toBeGreaterThan(60);
    // The belt keeps its exact pieces; the stories append.
    expect(districtDecor('D-CURE', layout.placements).slice(0, belt.length)).toEqual(belt);
  });

  it('keeps the walked line, roads, encounter slots and the finale clear', () => {
    const roads: Point[][] = [...cure.regions.map(r => r.route), ...cure.detours.map(d => d.route),
      [cure.regions[5].route[1], cure.anchors['corridor-breach'], cure.anchors['r6-r7-seam'], cure.regions[6].route[5]]];
    const slots = cureEncounters.filter(e => !e.assault).flatMap(e => (['high', 'low'] as const).flatMap(t => cureEncounterSlots(e, t)));
    const laneSlots = cureEncounters.filter(e => e.id.includes('-direct-') || e.id.startsWith('corridor-')).flatMap(e => (['high', 'low'] as const).flatMap(t => cureEncounterSlots(e, t)));
    const console_ = cure.anchors['cure-console'];
    for (const p of stories) {
      const li = Number(p.id.split('-')[3]), line = cureCrossingLines[li].line, a = p.visualAabb;
      for (const q of corners(a)) {
        expect(lineDistance(q, line)).toBeGreaterThanOrEqual(3.2);
        for (const r of roads) expect(lineDistance(q, r)).toBeGreaterThanOrEqual(8);
      }
      expect(Math.hypot(p.position[0] - console_[0], p.position[2] - console_[1])).toBeGreaterThan(100);
      expect(slots.some(s => s.x > a.min[0] - 4 && s.x < a.max[0] + 4 && s.z > a.min[2] - 4 && s.z < a.max[2] + 4)).toBe(false);
      // Lane-shifted groups (field-crossing patrols, corridor groups) spawn at the courier's z: no scene in their x band.
      expect(laneSlots.some(s => s.x > a.min[0] - 4 && s.x < a.max[0] + 4)).toBe(false);
    }
  });

  it('gives tall pieces real colliders and keeps small pieces render-only, standing on the ground', () => {
    const solids = stories.filter(p => !p.decor), small = stories.filter(p => p.decor);
    expect(solids.length).toBeGreaterThan(40);
    expect(placementColliders(small, [])).toEqual([]);
    const ids = new Set(placementColliders(solids, []).map(c => c.id.split('/')[0]));
    for (const p of solids) expect(ids.has(p.id)).toBe(true);
    // No piece intersects an existing solid (authored colliders included).
    const overlaps = stories.flatMap(p => layout.colliders.filter(c => !c.walkable && c.aabb.max[1] > .05 && p.visualAabb.min[0] < c.aabb.max[0] && p.visualAabb.max[0] > c.aabb.min[0]
      && p.visualAabb.min[2] < c.aabb.max[2] && p.visualAabb.max[2] > c.aabb.min[2]).map(c => `${p.id}/${c.id}`));
    expect(overlaps).toEqual([]);
    const world = new DistrictWorld(compositions.L10, [layout], 32);
    const placed = new Set(world.districts[0].decay.placements.map(p => p.id));
    // The ground under each piece, measured without the stories (a sandbag pallet carries its own 25 cm walkable deck).
    const bare = new DistrictWorld(compositions.L10, [{ ...layout, placements: [...layout.placements, ...belt] }], 32);
    for (const p of stories) {
      expect(placed.has(p.id)).toBe(true);
      for (const [x, z] of corners(p.visualAabb)) expect(Math.abs(bare.groundHeight(x, z) - p.position[1])).toBeLessThan(.05);
    }
  });
});
