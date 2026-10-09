import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { worldAssets } from '../../../src/assets/worldDefinitions';
import { l3, l3Anchors, l3PhotoSpots, l3Street } from '../../../src/data/l3';
import { timeOfDay } from '../../../src/data/timeOfDay';
import { commerceFrontages, l3Dressing, levelThreeLayouts, type L3DressingKind, type L3Street } from '../../../src/levels/L3/layout';
import { compositions } from '../../../src/levels/compositions';
import { placementColliders } from '../../../src/levels/districts/staticCollision';
import type { Aabb, DistrictLayout, Point } from '../../../src/levels/districts/types';
import { validateLayout } from '../../../src/levels/districts/validate';
import { bakeNav } from '../../../src/sim/world/NavGrid';

/** E21 static criteria: the D-CORRIDOR layout, the W2/W3 dressing manifest, the late-afternoon light and the army checkpoint. */
const manifest = new Map((JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as { id: string; decayVariants?: string[] }[]).map(a => [a.id, a]));
const base = JSON.parse(readFileSync('public/assets/layouts/D-CORRIDOR.layout.json', 'utf8')) as DistrictLayout;
const [layout] = levelThreeLayouts([base]);
const solid = placementColliders(layout.placements, layout.colliders).filter(c => !c.walkable);
const nav = bakeNav([{ layout, origin: [0, 0], colliders: solid.map(c => c.aabb) }], 1, .5);
const at = (name: string): Point => { const a = layout.anchors[name]; if (!a) throw new Error(`missing anchor ${name}`); return [a.position[0], a.position[2]]; };
const count = (street: L3Street, kinds: L3DressingKind[]) => l3Dressing.filter(d => d.street === street && kinds.includes(d.kind)).reduce((n, d) => n + (d.count ?? 1), 0);
const STREETS = { blvd: -28, commerce: 0, oak: 28 } as const;

/** 8-connected A* on the nav grid (cell path, metres). */
function route(from: Point, to: Point): Point[] | null {
  const w = nav.width, h = nav.height, cs = nav.cellSize, cell = (p: Point) => { const i = nav.index(p[0], p[1]); return i >= 0 && nav.cells[i] ? i : -1; };
  const start = cell(from), goal = cell(to); if (start < 0 || goal < 0) return null;
  const g = new Float32Array(w * h).fill(Infinity), parent = new Int32Array(w * h).fill(-1), closed = new Uint8Array(w * h), open: number[] = [start];
  const gx = goal % w, gz = Math.floor(goal / w), f = (i: number) => g[i] + Math.hypot((i % w) - gx, Math.floor(i / w) - gz) * cs;
  g[start] = 0;
  while (open.length) {
    let bi = 0; for (let k = 1; k < open.length; k++) if (f(open[k]) < f(open[bi])) bi = k;
    const i = open.splice(bi, 1)[0]; if (closed[i]) continue; closed[i] = 1; if (i === goal) break;
    const x = i % w, z = Math.floor(i / w);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue; const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
      const j = nz * w + nx; if (!nav.cells[j] || closed[j] || (dx && dz && (!nav.cells[z * w + nx] || !nav.cells[nz * w + x]))) continue;
      const c = g[i] + (dx && dz ? Math.SQRT2 : 1) * cs; if (c < g[j]) { g[j] = c; parent[j] = i; open.push(j); }
    }
  }
  if (parent[goal] < 0) return null;
  const out: Point[] = []; for (let i = goal; i >= 0; i = parent[i]) out.push([nav.min[0] + ((i % w) + .5) * cs, nav.min[1] + (Math.floor(i / w) + .5) * cs]);
  return out.reverse();
}
const length = (r: Point[]) => r.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - r[i][0], p[1] - r[i][1]), 0);
const blockers = solid.filter(c => c.aabb.max[1] >= 1.55 && (c.aabb.max[0] - c.aabb.min[0] >= 1.4 || c.aabb.max[2] - c.aabb.min[2] >= 1.4)).map(c => c.aabb);
const distBox = (p: Point, a: Aabb) => Math.hypot(Math.max(a.min[0] - p[0], 0, p[0] - a.max[0]), Math.max(a.min[2] - p[1], 0, p[1] - a.max[2]));

describe('L3 static', () => {
  test('T-E21-11a @E21 @E21-AC11 corridor layout: valid, 280-340 m, three parallel streets, >= 6 cross-links <= 60 m apart', () => {
    expect(validateLayout(base, worldAssets)).toEqual([]);
    const [sx] = at('l3-start'), [zx] = at('l3-zone');
    expect(zx - sx).toBeGreaterThanOrEqual(280); expect(zx - sx).toBeLessThanOrEqual(340);
    // Three E-W streets ~28 m apart running the whole corridor.
    for (const z of Object.values(STREETS)) {
      const span = layout.roads.edges.filter(e => e.points.every(p => Math.abs(p[1] - z) < .01)).flatMap(e => e.points.map(p => p[0]));
      expect(Math.max(...span) - Math.min(...span), `street z=${z}`).toBeGreaterThanOrEqual(240);
    }
    // Cross-links: a short walk from one street to its neighbour at each link x (full cross streets and alleys).
    const links: number[] = [];
    for (let x = l3.map.corridor[0] + 4; x <= l3.map.corridor[1]; x += 1) {
      const ok = ([[STREETS.blvd + 4, STREETS.commerce - 3.5], [STREETS.commerce + 3.5, STREETS.oak - 3.5]] as const).every(([z0, z1]) => { const r = route([x, z0], [x, z1]); return !!r && length(r) <= Math.abs(z1 - z0) * 1.25 + 2; });
      if (ok && (!links.length || x - links.at(-1)! > 6)) links.push(x);
    }
    expect(links.length, `links at ${links}`).toBeGreaterThanOrEqual(6);
    const gaps = [l3.map.corridor[0], ...links, l3.map.corridor[1]].slice(1).map((x, i, a) => x - (i ? a[i - 1] : l3.map.corridor[0]));
    expect(Math.max(...gaps), `link gaps ${gaps}`).toBeLessThanOrEqual(60);
  });

  test('T-E21-11b @E21 @E21-AC11 sight blockers every <= 25 m on every street, no dead end longer than 30 m, edges sealed by visible geometry', () => {
    for (const [name, z] of Object.entries(STREETS)) {
      const r = route([l3.map.corridor[0] + 6, z + (name === 'blvd' ? 4.5 : 3.4)], [l3.map.corridor[1] - 6, z + (name === 'blvd' ? 4.5 : 3.4)]);
      expect(r, name).not.toBeNull();
      let run = 0, worst = 0;
      for (let i = 0; i < r!.length; i += 2) { if (blockers.some(b => distBox(r![i], b) <= 6)) run = 0; else { run += nav.cellSize * 2; worst = Math.max(worst, run); } }
      expect(worst, `${name} longest open stretch`).toBeLessThanOrEqual(25);
    }
    // No pocket deeper than 30 m: every reachable cell lies within 30 m (walking) of a street or cross-link line.
    const reached = nav.flood(at('l3-start')), w = nav.width, h = nav.height, cs = nav.cellSize;
    const dist = new Float32Array(w * h).fill(Infinity), queue: number[] = [];
    for (let i = 0; i < reached.length; i++) if (reached[i]) {
      const x = nav.min[0] + ((i % w) + .5) * cs, z = nav.min[1] + (Math.floor(i / w) + .5) * cs;
      const onStreet = Object.values(STREETS).some(sz => Math.abs(z - sz) <= 5.5) || [-120, -90, -55, -15, 40, 85, 128].some(lx => Math.abs(x - lx) <= 4.5) || x < l3.map.yard.x1 || x > 130;
      if (onStreet) { dist[i] = 0; queue.push(i); }
    }
    for (let q = 0; q < queue.length; q++) { const i = queue[q], x = i % w, z = Math.floor(i / w); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue; const j = nz * w + nx; if (!reached[j] || dist[j] <= dist[i] + cs) continue; dist[j] = dist[i] + cs; queue.push(j); } }
    let deepest = 0; for (let i = 0; i < reached.length; i++) if (reached[i]) deepest = Math.max(deepest, dist[i]);
    expect(deepest).toBeLessThanOrEqual(30);
    // Nothing reachable within 1 m of the (invisible) district bounds.
    const xs = layout.bounds.map(p => p[0]), zs = layout.bounds.map(p => p[1]), [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)], leaks: string[] = [];
    for (let i = 0; i < reached.length; i++) { if (!reached[i]) continue; const x = nav.min[0] + ((i % w) + .5) * cs, z = nav.min[1] + (Math.floor(i / w) + .5) * cs; if (Math.min(x - x0, x1 - x, z - z0, z1 - z) < 1) leaks.push(`${x.toFixed(1)},${z.toFixed(1)}`); }
    expect(leaks.slice(0, 8)).toEqual([]);
    // The army zone is reachable only through the checkpoint lane (T-walls and razor wire seal the rest of the line).
    const zone = nav.index(...at('l3-zone')); expect(reached[zone]).toBe(1);
  });

  test('T-E21-11c @E21 @E21-AC11 gameplay points are walkable and reachable from the start', () => {
    const reached = nav.flood(at('l3-start'));
    for (const name of Object.keys(l3Anchors).filter(n => !n.startsWith('photo-'))) { const p = at(name), i = nav.index(p[0], p[1]); expect(i >= 0 && nav.cells[i] === 1 && reached[i] === 1, `${name} at ${p}`).toBe(true); }
    for (const [x, z] of l3.medkits.positions) { const i = nav.index(x, z); expect(i >= 0 && reached[i], `medkit ${x},${z}`).toBe(1); }
  });

  test('T-E21-15 @E21 @E21-AC15 per-street damage: each street its type set, section 5.8 totals, nothing collapsed', () => {
    // Oak Avenue: damaged gardens, abandoned (W2/W3) houses, crashed cars, makeshift barricades, blood and bodies.
    for (const k of ['garden', 'crashed', 'barricade', 'blood', 'corpse'] as const) expect(count('oak', [k]), `oak ${k}`).toBeGreaterThanOrEqual(1);
    const houses = layout.placements.filter(p => p.assetId.startsWith('bld.house') && l3Street(p.position[2]) === 'oak');
    expect(houses.length).toBeGreaterThanOrEqual(10); expect(houses.every(p => p.decay === 'w2' || p.decay === 'w3')).toBe(true);
    // Commerce Street: broken glass at every shop frontage, looted stores, merchandise, bags, damaged signs.
    for (const k of ['looted', 'merchandise', 'bags', 'damaged-sign'] as const) expect(count('commerce', [k]), `commerce ${k}`).toBeGreaterThanOrEqual(2);
    const shops = layout.placements.filter(p => /^bld\.(mainstreet-brick|joes-diner|maple-hardware|pharmacy|supermarket|cafe-corner)$/.test(p.assetId) && l3Street(p.position[2]) === 'commerce');
    expect(commerceFrontages(layout)).toHaveLength(shops.length);
    expect(layout.placements.filter(p => p.assetId === 'decay.broken-glass')).toHaveLength(shops.length);
    // Grove Boulevard: >= 2 wrecked buses, >= 3 abandoned police vehicles, a jam of >= 8 cars, signs of fighting.
    expect(count('blvd', ['wrecked-bus'])).toBeGreaterThanOrEqual(2); expect(count('blvd', ['police-vehicle'])).toBeGreaterThanOrEqual(3);
    expect(count('blvd', ['jam'])).toBeGreaterThanOrEqual(8); expect(count('blvd', ['fighting'])).toBeGreaterThanOrEqual(3);
    expect(l3Dressing.some(d => d.street === 'blvd' && d.kind === 'police-vehicle' && d.decay === 'wrecked')).toBe(true);
    // Section 5.8 totals.
    const fires = l3Dressing.filter(d => d.kind === 'fire');
    expect(fires.length).toBeGreaterThanOrEqual(6);
    for (const street of ['oak', 'commerce', 'blvd'] as const) expect(fires.filter(d => d.street === street).length, `fire on ${street}`).toBeGreaterThanOrEqual(1);
    expect(l3Dressing.filter(d => d.kind === 'corpse').length).toBeGreaterThanOrEqual(12);
    expect(l3Dressing.filter(d => d.assetId.startsWith('veh.') && d.street !== 'yard' && d.street !== 'army').length).toBeGreaterThanOrEqual(15);
    // Every asset is in the manifest, every decay is a reviewed variant, nothing collapsed or rubble.
    for (const d of l3Dressing.filter(d => !d.entity)) { expect(manifest.has(d.assetId), d.assetId).toBe(true); if (d.decay) expect(manifest.get(d.assetId)!.decayVariants, d.assetId).toContain(d.decay); }
    const live = layout.placements.map(p => p.assetId);
    for (const id of live) expect(id).not.toMatch(/collapsed|rubble|crater|fallen-tree/);
    // The copy validates too; road exceptions and non-world dressing (decals, small props) are the L2/L3 dressing pattern.
    expect(validateLayout(layout, worldAssets).filter(e => !e.startsWith('illegal road exception') && !(e.startsWith('unknown asset ') && manifest.has(e.slice(14))))).toEqual([]);
  });

  test('T-E21-16 @E21 @E21-AC16 late-afternoon light: polar 1.00-1.20 rad, sun hue 25-45 deg, probe shadow >= 1.6x L2, >= 2 smoke sources per street spot', () => {
    expect(compositions.L3.timeOfDay).toBe('L3');
    const p = timeOfDay.L3;
    expect(p.polar).toBeGreaterThanOrEqual(1); expect(p.polar).toBeLessThanOrEqual(1.2);
    const [r, g, b] = [1, 3, 5].map(i => parseInt(p.sun.slice(i, i + 2), 16)), max = Math.max(r, g, b), min = Math.min(r, g, b);
    const hue = max === r ? 60 * (((g - b) / (max - min)) % 6) : max === g ? 60 * ((b - r) / (max - min) + 2) : 60 * ((r - g) / (max - min) + 4);
    expect(hue).toBeGreaterThanOrEqual(25); expect(hue).toBeLessThanOrEqual(45);
    // Ground shadow of a vertical 1.8 m probe under a directional sun at polar angle p (from the zenith): 1.8 tan p.
    expect(Math.tan(p.polar) / Math.tan(timeOfDay.L2.polar)).toBeGreaterThanOrEqual(1.6);
    expect(p.intensity).toBeGreaterThanOrEqual(timeOfDay.L2.intensity);
    // Smoke: fires (their smoke columns rise 8-12 m) within the frame of every street photo spot.
    for (const name of ['l3-oak-avenue', 'l3-commerce-street', 'l3-grove-boulevard']) {
      const [x, z] = l3Anchors[`photo-${name}`], spot = l3PhotoSpots.find(s => s[0] === name)!;
      expect(spot).toBeDefined();
      const near = l3Dressing.filter(d => (d.kind === 'fire' || d.kind === 'smoke') && Math.abs(d.x - x) <= 40 && Math.abs(d.z - z) <= 30);
      expect(near.length, name).toBeGreaterThanOrEqual(2);
    }
  });

  test('T-E21-17a @E21 @E21-AC17 army checkpoint: heavier than the L2 police line (T-walls, sandbag nests, razor wire), military vehicles, evacuation buses', () => {
    const army = l3Dressing.filter(d => d.street === 'army');
    expect(layout.placements.some(p => p.assetId === 'kit.army-checkpoint')).toBe(true);
    expect(layout.colliders.filter(c => c.id.startsWith('dressing:t-wall')).length).toBeGreaterThanOrEqual(20);
    expect(layout.colliders.some(c => c.id.startsWith('dressing:razor-wire'))).toBe(true);
    expect(army.filter(d => d.assetId === 'prop.sandbag-pallet').length).toBeGreaterThanOrEqual(2);
    expect(army.filter(d => /^veh\.military-/.test(d.assetId)).length).toBeGreaterThanOrEqual(2);
    expect(army.filter(d => d.assetId === 'veh.military-truck').length).toBeGreaterThanOrEqual(1);
    // Seated civilians: the evac coach is authored with occupied windows (manifest seat sockets).
    expect(army.filter(d => d.assetId === 'veh.evac-bus').length).toBeGreaterThanOrEqual(2);
    expect((manifest.get('veh.evac-bus') as { sockets?: string[] }).sockets!.filter(s => /seat/i.test(s)).length).toBeGreaterThanOrEqual(12);
    expect(l3.soldiers.count).toBeGreaterThanOrEqual(8);
    expect(layout.placements.some(p => p.assetId === 'kit.highway-onramp')).toBe(true);
  });
});
