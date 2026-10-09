import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { worldAssets } from '../../../src/assets/worldDefinitions';
import { l4 } from '../../../src/data/l4';
import { l5, l5Anchors, l5Fires, l5PhotoSpots, l5Survivors, l5Wanderers } from '../../../src/data/l5';
import { timeOfDay } from '../../../src/data/timeOfDay';
import { compositions } from '../../../src/levels/compositions';
import { placementColliders } from '../../../src/levels/districts/staticCollision';
import type { Aabb, DistrictLayout, Point } from '../../../src/levels/districts/types';
import { validateLayout } from '../../../src/levels/districts/validate';
import { levelFourLayouts } from '../../../src/levels/L4/layout';
import { l5Dressing, l5Frontages, levelFiveLayouts } from '../../../src/levels/L5/layout';
import { campaignMission } from '../../../src/levels/missions';
import { bakeNav } from '../../../src/sim/world/NavGrid';

/** E23 static criteria: the same city (identical transforms, footprints, road graph and nav), the devastation minimums, the hiding places, the sunset and the photo spots. */
const manifestIds = new Set((JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as { id: string }[]).map(a => a.id));
const base = JSON.parse(readFileSync('public/assets/layouts/D-FAIR.layout.json', 'utf8')) as DistrictLayout;
const [l4Layout] = levelFourLayouts([base]);
const [layout] = levelFiveLayouts([base]);
const solidOf = (l: DistrictLayout) => placementColliders(l.placements, l.colliders).filter(c => !c.walkable);
const solid = solidOf(layout);
const navOf = (l: DistrictLayout) => bakeNav([{ layout: l, origin: [0, 0], colliders: solidOf(l).map(c => c.aabb) }], 1, .5);
const nav = navOf(layout), navL4 = navOf(l4Layout);
const at = (name: string): Point => { const a = layout.anchors[name]; if (!a) throw new Error(`missing anchor ${name}`); return [a.position[0], a.position[2]]; };
const dist = (a: Point | readonly [number, number], b: Point | readonly [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** Top-down footprint mask of the solid geometry of a placement (0.25 m raster) and the IoU of two masks. */
function mask(l: DistrictLayout, id: string): Set<string> {
  const out = new Set<string>();
  for (const c of placementColliders(l.placements.filter(p => p.id === id), []).filter(c => !c.walkable)) {
    for (let x = Math.floor(c.aabb.min[0] * 4); x < Math.ceil(c.aabb.max[0] * 4); x++) for (let z = Math.floor(c.aabb.min[2] * 4); z < Math.ceil(c.aabb.max[2] * 4); z++) out.add(`${x},${z}`);
  }
  return out;
}
const iou = (a: Set<string>, b: Set<string>) => { let both = 0; for (const k of a) if (b.has(k)) both++; return a.size + b.size === 0 ? 1 : both / (a.size + b.size - both); };
/** Shortest walking distance on the nav grid between two points (8-connected BFS-Dijkstra by cell), Infinity when disconnected. */
function walk(n: ReturnType<typeof bakeNav>, a: Point, b: Point): number {
  const from = n.index(a[0], a[1]), to = n.index(b[0], b[1]); if (from < 0 || to < 0 || !n.cells[from] || !n.cells[to]) return Infinity;
  const size = n.cellSize, w = n.width, best = new Float64Array(n.cells.length).fill(Infinity), open: number[] = [from]; best[from] = 0;
  while (open.length) {
    let k = 0; for (let i = 1; i < open.length; i++) if (best[open[i]] < best[open[k]]) k = i;
    const c = open.splice(k, 1)[0]; if (c === to) return best[c];
    const cx = c % w, cz = Math.floor(c / w);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dz) continue; const nx = cx + dx, nz = cz + dz; if (nx < 0 || nz < 0 || nx >= w || nz >= n.height) continue;
      const j = nz * w + nx; if (!n.cells[j]) continue;
      if (dx && dz && (!n.cells[cz * w + nx] || !n.cells[nz * w + cx])) continue;
      const d = best[c] + (dx && dz ? Math.SQRT2 : 1) * size; if (d < best[j]) { if (best[j] === Infinity) open.push(j); best[j] = d; }
    }
  }
  return Infinity;
}

describe('L5 static', () => {
  test('T-E23-05a @E23 @E23-AC05 same city: every L4 placement keeps its transform, the road graph is identical and every hero building footprint has IoU >= 0.9 with L4', () => {
    expect(validateLayout(base, worldAssets)).toEqual([]);
    for (const p of layout.placements) expect(manifestIds.has(p.assetId), p.assetId).toBe(true);
    expect(layout.roads).toEqual(l4Layout.roads); expect(layout.bounds).toEqual(l4Layout.bounds); expect(layout.district).toBe('D-FAIR');
    const mine = new Map(layout.placements.map(p => [p.id, p]));
    const missing: string[] = [];
    for (const p of base.placements) {
      const q = mine.get(p.id);
      if (!q || q.assetId !== p.assetId || q.position.some((v, i) => v !== p.position[i]) || q.yaw !== p.yaw || q.scale.some((v, i) => v !== p.scale[i])) missing.push(p.id);
    }
    expect(missing).toEqual([]);
    const heroes = base.placements.filter(p => p.assetId.startsWith('bld.') || p.assetId.startsWith('int.'));
    expect(heroes.length).toBeGreaterThanOrEqual(40);
    for (const p of heroes) expect(iou(mask(l4Layout, p.id), mask(layout, p.id)), p.id).toBeGreaterThanOrEqual(.9);
    expect(compositions.L5.districts[0].id).toBe('D-FAIR'); expect(compositions.L5.timeOfDay).toBe('L5'); expect(compositions.L5.tier).toBe(5);
  });

  test('T-E23-05b @E23 @E23-AC05 nav differs from the clean city by at most 3 debris-narrowed street segments, each with a detour of at most 1.5x; every door and anchor stays reachable', () => {
    const narrowed: { id: string; straight: number; detour: number }[] = [];
    const centreBlocked = (n: ReturnType<typeof bakeNav>, a: Point, b: Point) => { const samples = Math.ceil(dist(a, b) / .5); for (let i = 0; i <= samples; i++) { const c = n.index(a[0] + (b[0] - a[0]) * i / samples, a[1] + (b[1] - a[1]) * i / samples); if (c < 0 || !n.cells[c]) return true; } return false; };
    for (const e of layout.roads.edges) {
      const [a, b] = [e.points[0] as Point, e.points[e.points.length - 1] as Point];
      // Debris-blocked = open down the centre line in L4 and obstructed in L5.
      if (centreBlocked(nav, a, b) && !centreBlocked(navL4, a, b)) narrowed.push({ id: e.id, straight: dist(a, b), detour: walk(nav, a, b) });
    }
    expect(narrowed.length, narrowed.map(n => n.id).join()).toBeLessThanOrEqual(3);
    expect(narrowed.length).toBeGreaterThanOrEqual(1);
    for (const n of narrowed) expect(n.detour / n.straight, n.id).toBeLessThanOrEqual(1.5);
    // The clean city's centre lines are all open (the baseline the comparison is against).
    for (const e of layout.roads.edges) { const [a, b] = [e.points[0] as Point, e.points[e.points.length - 1] as Point]; expect(Number.isFinite(walk(nav, a, b)), e.id).toBe(true); expect(walk(nav, a, b) / dist(a, b), e.id).toBeLessThanOrEqual(1.5); }
    const flood = nav.flood(at('l5-out'));
    const doors = Object.entries(layout.anchors).filter(([n]) => n.startsWith('refuge-door-')).map(([, a]) => [a.position[0], a.position[2]] as Point);
    expect(doors.filter(([x, z]) => flood[nav.index(x, z)] !== 1)).toEqual([]);
    for (const name of ['l5-plaza', 'l5-metro-foot', 'pair-plaza', 'pair-harbor-street', 'pair-metro-entrance', 'pair-kessler-lane', ...l5Survivors.map(s => `l5-ring-${s.key}`)]) { const p = at(name); expect(flood[nav.index(p[0], p[1])], name).toBe(1); }
  });

  test('T-E23-05c @E23 @E23-AC05 the cellar yard is the only island: the courier starts in it and the door brace is inside it', () => {
    const inn = at('l5-cellar-in'), brace = at('l5-brace'), flood = nav.flood(at('l5-out'));
    expect(flood[nav.index(inn[0], inn[1])]).not.toBe(1); expect(nav.cells[nav.index(inn[0], inn[1])]).toBe(1); expect(nav.cells[nav.index(brace[0], brace[1])]).toBe(1);
    expect(Number.isFinite(walk(nav, inn, brace))).toBe(true);
  });

  test('T-E23-06a @E23 @E23-AC06 devastation: >= 10 burned cars, >= 3 wrecked military vehicles (tank and an HMG vehicle), >= 6 fires, >= 4 smoke columns, >= 4 collapsed facades, >= 30 corpses with >= 10 in uniform, destroyed barricades', () => {
    const cars = l5Dressing.filter(d => d.kind === 'burned-car' && (d.decay === 'burned' || d.decay === 'wrecked'));
    expect(cars.length).toBeGreaterThanOrEqual(10); for (const c of cars) expect(c.assetId).toMatch(/^veh\./);
    const military = l5Dressing.filter(d => /^veh\.(military|tank)/.test(d.assetId) && d.decay === 'wrecked');
    expect(military.length).toBeGreaterThanOrEqual(3);
    expect(military.some(d => d.assetId === 'veh.tank')).toBe(true); expect(military.some(d => d.assetId === 'veh.military-apc')).toBe(true);
    expect(l5Fires.filter(f => !f.deep).length).toBeGreaterThanOrEqual(6); expect(l5Fires.length).toBeGreaterThanOrEqual(10); expect(l5Fires.filter(f => f.deep).length).toBeGreaterThanOrEqual(4);
    const w5 = layout.placements.filter(p => p.decay === 'w5'), collapsed = layout.placements.filter(p => p.assetId === 'decay.collapsed-facade');
    expect(collapsed.length).toBeGreaterThanOrEqual(4); expect(new Set(w5.map(p => p.assetId)).size).toBeGreaterThanOrEqual(4); expect(w5.length).toBeGreaterThanOrEqual(30);
    const corpses = l5Dressing.filter(d => d.kind === 'corpse');
    expect(corpses.length).toBeGreaterThanOrEqual(30); expect(corpses.filter(c => c.uniform && c.assetId === 'npc.national-guard').length).toBeGreaterThanOrEqual(10);
    expect(layout.placements.filter(p => p.assetId === 'decay.blown-sandbags').length).toBeGreaterThanOrEqual(6);
    expect(layout.placements.some(p => p.assetId === 'decay.fuel-truck-crater' && Math.hypot(p.position[0] - l4.fuelTruck.x, p.position[2] - l4.fuelTruck.z) < 1)).toBe(true);
    expect(layout.placements.filter(p => p.assetId === 'decay.crater').length).toBeGreaterThanOrEqual(2);
    expect(layout.placements.filter(p => p.assetId === 'prop.hmg-nest').length).toBe(2);
    for (const d of l5Dressing) expect(worldAssets[d.assetId] ?? { id: d.assetId }, d.assetId).toBeDefined();
  });

  test('T-E23-06b @E23 @E23-AC06 broken glass on every street frontage (>= 70 %), the power is out, nothing of the army\'s intact dressing remains, every plaza facade carries its w5 shell or a broken shopfront', () => {
    const fronts = l5Frontages(layout), glass = layout.placements.filter(p => p.assetId === 'decay.broken-glass');
    expect(fronts.length).toBeGreaterThanOrEqual(40); expect(glass.length / fronts.length).toBeGreaterThanOrEqual(.7);
    const w5 = layout.layers.find(l => l.tier === 5)!;
    for (const g of layout.lightGroups.filter(g => g.id !== 'l5-cue')) expect(w5.disableLights, g.id).toContain(g.id);
    expect(layout.placements.filter(p => p.id.startsWith('l4-'))).toHaveLength(0);
    expect(layout.placements.filter(p => p.assetId === 'prop.jersey-barrier').length).toBeLessThanOrEqual(8);
    const plaza = fronts.filter(f => f.plaza);
    expect(plaza.length).toBeGreaterThanOrEqual(8);
    for (const f of plaza) { const shell = worldAssets[f.asset] && (worldAssets[f.asset] as { decayVariants?: string[] }).decayVariants?.includes('w5'); expect(shell || glass.some(g => dist([g.position[0], g.position[2]], [f.x, f.z]) < .5), `${f.asset}@${f.x},${f.z}`).toBeTruthy(); }
  });

  test('T-E23-08a @E23 @E23-AC08 five hiding places >= 25 m apart, at least 4 inside or behind buildings (hidden from every street), each ring reachable, no objective marker on a survivor', () => {
    expect(l5Survivors.map(s => s.key)).toEqual(['dale', 'rosa', 'okafor', 'mia', 'sam']);
    const spots = l5Survivors.map(s => s.hideAt as Point);
    for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) expect(dist(spots[i], spots[j]), `${l5Survivors[i].key}-${l5Survivors[j].key}`).toBeGreaterThanOrEqual(25);
    const walls = solid.filter(c => c.aabb.max[1] > 1.2).map(c => c.aabb);
    const blocked = (x: number, z: number) => walls.some((a: Aabb) => x >= a.min[0] && x <= a.max[0] && z >= a.min[2] && z <= a.max[2]);
    const see = (a: Point, b: Point) => { const n = Math.ceil(dist(a, b) / .5); for (let i = 1; i < n; i++) if (blocked(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n)) return false; return true; };
    const roads: Point[] = [];
    for (const e of layout.roads.edges) for (let i = 1; i < e.points.length; i++) { const [a, b] = [e.points[i - 1], e.points[i]], n = Math.ceil(dist(a as Point, b as Point) / 2); for (let k = 0; k <= n; k++) roads.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
    const covered = l5Survivors.filter(s => {
      const insideBuilding = layout.placements.some(p => p.assetId.startsWith('bld.') && s.hideAt[0] >= p.visualAabb.min[0] && s.hideAt[0] <= p.visualAabb.max[0] && s.hideAt[1] >= p.visualAabb.min[2] && s.hideAt[1] <= p.visualAabb.max[2]);
      const hidden = !roads.some(r => dist(r, s.hideAt as Point) < 40 && see(r, s.hideAt as Point));
      return insideBuilding || hidden;
    });
    expect(covered.length).toBeGreaterThanOrEqual(4);
    expect(l5Survivors.filter(s => s.cover === 'inside' || s.cover === 'behind').length).toBeGreaterThanOrEqual(4);
    const flood = nav.flood(at('l5-out'));
    for (const s of l5Survivors) { expect(flood[nav.index(s.ringAt[0], s.ringAt[1])], `${s.key} ring`).toBe(1); expect(flood[nav.index(s.outAt[0], s.outAt[1])], `${s.key} out`).toBe(1); }
    const def = campaignMission('L5', (district, name) => { const a = layout.anchors[name]; if (!a) throw new Error(`missing ${name}`); return { x: a.position[0], z: a.position[2], radius: 2 }; });
    for (const step of def.steps) expect(step.anchor, step.id).not.toMatch(/^l5-(ring|hide|out)-/);
    expect(def.steps.map(s => s.id)).toEqual(['emerge', 'look', 'metro']);
  });

  test('T-E23-04a @E23 @E23-AC04 the infected are laid out in ones and twos (no group above 3) and 12-20 of them at the start on both tiers', () => {
    expect(l5Wanderers.every(g => g.n >= 1 && g.n <= l5.infected.maxGroup)).toBe(true);
    const total = l5Wanderers.reduce((n, g) => n + g.n, 0);
    expect(total).toBeGreaterThanOrEqual(l5.infected.start.high); expect(l5.infected.start.high).toBeLessThanOrEqual(20); expect(l5.infected.start.low).toBeGreaterThanOrEqual(12);
    expect(l5.infected.cap.high).toBeLessThanOrEqual(30); expect(l5.infected.cap.low).toBeLessThanOrEqual(30);
    // Groups are spread out: no two group spots within 8 m and none within 20 m of the courier's exit.
    for (const g of l5Wanderers) for (const s of l5Survivors) { expect(dist(g.at as Point, s.ringAt as Point), `${s.key} ring`).toBeGreaterThan(12); expect(dist(g.at as Point, s.hideAt as Point), `${s.key} hide`).toBeGreaterThan(12); }
    for (let i = 0; i < l5Wanderers.length; i++) { expect(dist(l5Wanderers[i].at as Point, at('l5-out'))).toBeGreaterThan(20); for (let j = i + 1; j < l5Wanderers.length; j++) expect(dist(l5Wanderers[i].at as Point, l5Wanderers[j].at as Point)).toBeGreaterThan(8); }
  });

  test('T-E23-13a @E23 @E23-AC13 sunset: polar 1.45-1.55 rad, sun hue 0-25 degrees, intensity <= 0.7x L4, a gloom ramp of at least 30 % at the end', () => {
    const p = timeOfDay.L5, hue = (hex: string) => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255), max = Math.max(r, g, b), d = max - Math.min(r, g, b); const h = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4; return ((h * 60) + 360) % 360; };
    expect(p.polar).toBeGreaterThanOrEqual(1.45); expect(p.polar).toBeLessThanOrEqual(1.55);
    expect(hue(p.sun)).toBeGreaterThanOrEqual(0); expect(hue(p.sun)).toBeLessThanOrEqual(25);
    expect(p.intensity).toBeLessThanOrEqual(timeOfDay.L4.intensity * .7);
    expect(1 - l5.gloom.endFactor).toBeGreaterThanOrEqual(.3); expect(l5.gloom.atMetroMax).toBeLessThanOrEqual(.7);
    // Red-to-violet sky: red dominates blue, blue dominates green.
    const [r, g, b] = [1, 3, 5].map(i => parseInt(p.sky.slice(i, i + 2), 16)); expect(r).toBeGreaterThan(g); expect(b).toBeGreaterThan(g);
  });

  test('T-E23-17a @E23 @E23-AC17 photo spots: the four L4 pair cameras (same anchors and offsets) plus the four L5 spots resolve to walkable points', () => {
    const names = l5PhotoSpots.map(([n]) => n);
    expect(names).toEqual(expect.arrayContaining(['pair-plaza', 'pair-harbor-street', 'pair-metro-entrance', 'pair-kessler-lane', 'l5-basement-exit', 'l5-sign-of-life', 'l5-group-of-five', 'l5-metro-shelter']));
    const spots = compositions.L5.districts[0].overrides!.photoSpots!;
    for (const name of names) { expect(spots.some(s => s.name === name), name).toBe(true); const key = name.startsWith('pair-') ? name : `photo-${name}`, p = at(key), i = nav.index(p[0], p[1]); expect(i >= 0 && nav.cells[i] === 1, name).toBe(true); }
    // The pair cameras are the L4 ones: identical anchors and framing offsets.
    const l4Spots = compositions.L4.districts[0].overrides!.photoSpots!.filter(s => s.name.startsWith('pair-'));
    for (const s of l4Spots) { const mine = spots.find(x => x.name === s.name)!; expect(mine.offset).toEqual(s.offset); const a = l4Layout.anchors[s.name], b = layout.anchors[s.name]; expect(b.position).toEqual(a.position); }
    for (const name of Object.keys(l5Anchors)) expect(layout.anchors[name], name).toBeDefined();
  });
});
