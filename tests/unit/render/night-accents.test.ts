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
  // l9-night-look: verge debris fires keep a light in the narrow follow-camera frame. Only frustum-visible fires draw (Blasts
  // FLAMES/GLOWS caps), so the total is a layout budget, not a per-frame cost.
  expect(fires.length).toBeGreaterThan(150); expect(fires.length).toBeLessThan(260);
  // E18/E25: the light field draws pools inside its 60 m (low) window only; even the densest window stays far below 256.
  const pools = points.filter(a => a.pool);
  expect(pools.length).toBeLessThan(240);
  const windowMax = Math.max(...pools.map(c => pools.filter(a => Math.abs(a.x - c.x) < 30 && Math.abs(a.z - c.z) < 30).length + fires.filter(f => Math.abs(f.x - c.x) < 30 && Math.abs(f.z - c.z) < 30).length));
  expect(windowMax).toBeLessThan(96);
  for (const a of points) { expect(Math.abs(a.x)).toBeLessThan(600); expect(Math.abs(a.z)).toBeLessThan(400); }
  // Studs sit on the asphalt edge lines; drive-over emitters (flares, lanterns) never stand inside a placement footprint.
  for (const a of points.filter(p => p.kind === 'stud')) expect(lane([a.x, a.z])).toBeLessThan(0);
  const inside = (x: number, z: number, m: number) => layout.placements.some(p => x > p.visualAabb.min[0] - m && x < p.visualAabb.max[0] + m && z > p.visualAabb.min[2] - m && z < p.visualAabb.max[2] + m);
  for (const a of points.filter(p => p.kind === 'flare' || p.kind === 'lantern')) expect(inside(a.x, a.z, .5), `${a.kind} ${a.x},${a.z}`).toBe(false);
  // Brush fires burn away from every lane and building; burning wrecks sit on their car.
  for (const f of fires.filter(f => !f.car && !f.life)) { expect(lane([f.x, f.z])).toBeGreaterThan(7.5); expect(inside(f.x, f.z, 1.6)).toBe(false); }
  // Verge debris fires (life): off the carriageway, clear of every footprint, small.
  const verge = fires.filter(f => f.life);
  expect(verge.length).toBeGreaterThan(80);
  for (const f of verge) {
    // Crash wreckage on the far deck (x > 528) burns beside the crawl line (|z| <= 3.2), everything else off the carriageway.
    if (f.x > 528) expect(Math.abs(f.z)).toBeGreaterThan(4); else expect(lane([f.x, f.z])).toBeGreaterThan(1.2);
    expect(inside(f.x, f.z, .5)).toBe(false); expect(f.radius).toBeLessThan(.85);
  }
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

test('@E32 L10 night accents: render-only fires on the crash scar and the destroyed corridor keep clear of every AI line', async () => {
  const { cureAccents } = await import('../../../src/render/NightAccents');
  const { cure } = await import('../../../src/levels/L10/district');
  const { cureEncounters, cureMedkits } = await import('../../../src/levels/L10/encounters');
  const cureLayout = JSON.parse(readFileSync('public/assets/layouts/D-CURE.layout.json', 'utf8')) as DistrictLayout;
  const { points, fires: allFires } = cureAccents(cureLayout.placements);
  const fires = allFires.filter(f => !f.life), life = allFires.filter(f => f.life);
  expect(fires.length).toBeGreaterThan(6); expect(fires.length).toBeLessThan(60);
  const lines: Point[][] = [...cure.regions.map(r => r.route as Point[]), ...cure.detours.map(d => d.route as Point[])];
  const laneAt = (p: Point) => Math.min(...lines.map(l => Math.min(...l.slice(1).map((b, i) => seg(p, l[i], b))))) - 4;
  for (const f of fires) {
    expect(laneAt([f.x, f.z])).toBeGreaterThan(f.car ? 8.5 : 12);   // pools (<= 7 m) stay out of the AC16 verge band
    for (const s of [...cureEncounters.map(e => e.at), ...cureMedkits.map(m => m.at)]) expect(Math.hypot(f.x - s[0], f.z - s[1])).toBeGreaterThan(14);
    expect(Math.hypot(f.x - cure.anchors['cure-console'][0], f.z - cure.anchors['cure-console'][1])).toBeGreaterThan(70);
    expect(f.x < 760 || (f.x >= 2917 && f.x < 3700)).toBe(true);   // R1 and R6 (region envelopes)
  }
  expect(fires.some(f => f.car)).toBe(true);
  // Road life (barrels, a burning car per region, lit bus stops, police light bars): just outside the 6 m clearance, never on a story spot.
  expect(life.length).toBeGreaterThan(8); expect(life.length).toBeLessThan(80);
  for (const f of life) {
    expect(laneAt([f.x, f.z])).toBeGreaterThan(1);
    for (const s of [...cureEncounters.map(e => e.at), ...cureMedkits.map(m => m.at)]) expect(Math.hypot(f.x - s[0], f.z - s[1])).toBeGreaterThan(9);
    expect(Math.hypot(f.x - cure.anchors['cure-console'][0], f.z - cure.anchors['cure-console'][1])).toBeGreaterThan(70);
  }
  expect(points.length).toBeGreaterThan(4);
  for (const a of points) expect(laneAt([a.x, a.z])).toBeGreaterThan(1);
  expect(points.some(a => a.kind === 'beacon') && points.some(a => a.kind === 'lantern')).toBe(true);
});
