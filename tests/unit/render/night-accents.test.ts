import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { accentLights, accentPulse, crossingAccents, nightAccents } from '../../../src/render/NightAccents';
import { crossing } from '../../../src/levels/L9/district';
import { DistrictWorld } from '../../../src/sim/world/DistrictWorld';
import { compositions } from '../../../src/levels/compositions';
import type { DistrictLayout, Point } from '../../../src/levels/districts/types';

const layout = JSON.parse(readFileSync('public/assets/layouts/D-CROSSING.layout.json', 'utf8')) as DistrictLayout;
const seg = (p: Point, a: Point, b: Point) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
};
const lane = (p: Point) => Math.min(...crossing.routes.map(r => Math.min(...r.points.slice(1).map((b, i) => seg(p, r.points[i], b))) - r.width / 2));

test('@E31 L9 night accents: light points along every route, on budget, render-only and clear of the placements', () => {
  const { points, fires } = crossingAccents(layout.placements);
  const count = (kind: string) => points.filter(a => a.kind === kind).length;
  expect(count('stud')).toBeGreaterThan(200); expect(count('lantern')).toBeGreaterThan(12); expect(count('flare')).toBeGreaterThan(15);
  expect(count('hazard') % 4).toBe(0); expect(count('hazard')).toBeGreaterThanOrEqual(8); expect(count('beacon')).toBeGreaterThanOrEqual(6);
  expect(fires.length).toBeGreaterThan(12); expect(fires.length).toBeLessThan(96);
  // E18/E25: pools stay a small share of the light-field capacity (256 low), the emitters two instanced draws.
  expect(points.filter(a => a.pool).length).toBeLessThan(140);
  for (const a of points) { expect(Math.abs(a.x)).toBeLessThan(600); expect(Math.abs(a.z)).toBeLessThan(400); }
  // Studs sit on the asphalt edge lines; drive-over emitters (flares, lanterns) never stand inside a placement footprint.
  for (const a of points.filter(p => p.kind === 'stud')) expect(lane([a.x, a.z])).toBeLessThan(0);
  const inside = (x: number, z: number, m: number) => layout.placements.some(p => x > p.visualAabb.min[0] - m && x < p.visualAabb.max[0] + m && z > p.visualAabb.min[2] - m && z < p.visualAabb.max[2] + m);
  for (const a of points.filter(p => p.kind === 'flare' || p.kind === 'lantern')) expect(inside(a.x, a.z, .5), `${a.kind} ${a.x},${a.z}`).toBe(false);
  // Brush fires burn away from every lane and building; burning wrecks sit on their car.
  for (const f of fires.filter(f => !f.car)) { expect(lane([f.x, f.z])).toBeGreaterThan(7.5); expect(inside(f.x, f.z, 1.6)).toBe(false); }
  // One hazard car blinks in a single phase, in step with its pool.
  const hazards = points.filter(a => a.kind === 'hazard');
  for (let i = 0; i < hazards.length; i += 4) expect(new Set(hazards.slice(i, i + 4).map(a => a.seed)).size).toBe(1);
  expect(accentPulse({ flicker: 0, strobe: true, seed: 0 }, .1)).toBe(1); expect(accentPulse({ flicker: 0, strobe: true, seed: 0 }, .6)).toBeLessThan(.1);
});

test('@E31 L9 night accents do not move with a Scene Lab crop (keyed random streams)', () => {
  const box = [[-200, -120], [200, 120]], within = (x: number, z: number, m = 0) => x > box[0][0] + m && x < box[1][0] - m && z > box[0][1] + m && z < box[1][1] - m;
  const cropped = crossingAccents(layout.placements.filter(p => within(p.position[0], p.position[2])));
  const full = crossingAccents(layout.placements), key = (a: { x: number; z: number }) => `${a.x.toFixed(2)},${a.z.toFixed(2)}`;
  const inner = (list: { x: number; z: number }[]) => list.filter(a => within(a.x, a.z, 30)).map(key).sort();
  expect(inner(cropped.points)).toEqual(inner(full.points)); expect(inner(cropped.fires)).toEqual(inner(full.fires));
});

test('@E31 L9 night accents are part of the crossing light field only, and the farms/diner have power', () => {
  const world = new DistrictWorld(compositions['D-CROSSING'], [layout], 31);
  expect(nightAccents(world)).toBe(nightAccents(world));
  expect(accentLights(world).length).toBe(nightAccents(world).points.filter(a => a.pool).length);
  for (const light of accentLights(world)) { expect(light.on).toBe(true); expect(light.id).toBeUndefined(); }
  expect(nightAccents(null).points).toEqual([]);
  expect(world.districts[0].decay.lights).toContain('crossing-lit');
  expect(layout.placements.filter(p => p.lightGroup === 'crossing-lit' && p.assetId.startsWith('bld.house-')).length).toBeGreaterThanOrEqual(6);
  expect(layout.placements.filter(p => p.assetId === 'prop.utility-pole' && p.scale[1] > 2)).toHaveLength(3);
});
