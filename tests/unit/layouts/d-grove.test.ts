import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { worldAssets } from '../../../src/assets/worldDefinitions';
import { placementColliders } from '../../../src/levels/districts/staticCollision';
import type { Aabb, DistrictLayout, Point } from '../../../src/levels/districts/types';
import { validateLayout } from '../../../src/levels/districts/validate';
import { bakeNav, type NavGrid } from '../../../src/sim/world/NavGrid';

/** Lane A. D-GROVE layout contract (E19 v2 section 4): crossing time, route redundancy, return loop, sight blockers, no invisible walls. */
const layout = JSON.parse(readFileSync('public/assets/layouts/D-GROVE.layout.json', 'utf8')) as DistrictLayout;
const colliders = placementColliders(layout.placements, layout.colliders);
const solid = colliders.filter((c) => !c.walkable);
const nav: NavGrid = bakeNav([{ layout, origin: [0, 0], colliders: solid.map((c) => c.aabb) }], 1, 0.5);
const at = (name: string): Point => {
  const a = layout.anchors[name];
  if (!a) throw new Error(`missing anchor ${name}`);
  return [a.position[0], a.position[2]];
};
const RUN = 4.5;

/** 8-connected A* on the nav grid; `blocked` marks extra cells that may not be used. */
function route(from: Point, to: Point, blocked?: Uint8Array, penalty?: Float32Array): Point[] | null {
  const w = nav.width, h = nav.height, n = w * h, cs = nav.cellSize;
  const cell = (p: Point) => {
    let i = nav.index(p[0], p[1]);
    if (i >= 0 && nav.cells[i] && !blocked?.[i]) return i;
    const [cx, cz] = [Math.floor((p[0] - nav.min[0]) / cs), Math.floor((p[1] - nav.min[1]) / cs)];
    for (let r = 1; r <= 4; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const x = cx + dx, z = cz + dz;
      if (x < 0 || z < 0 || x >= w || z >= h) continue;
      i = z * w + x;
      if (nav.cells[i] && !blocked?.[i]) return i;
    }
    return -1;
  };
  const start = cell(from), goal = cell(to);
  if (start < 0 || goal < 0) return null;
  const g = new Float32Array(n).fill(Infinity), parent = new Int32Array(n).fill(-1), closed = new Uint8Array(n);
  const heap: [number, number][] = [];
  const push = (f: number, i: number) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let k = 0; for (;;) { let m = k; const l = 2 * k + 1, r = l + 1; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  const gx = goal % w, gz = Math.floor(goal / w);
  const heur = (i: number) => Math.hypot((i % w) - gx, Math.floor(i / w) - gz) * cs;
  g[start] = 0; push(heur(start), start);
  while (heap.length) {
    const [, i] = pop();
    if (closed[i]) continue;
    closed[i] = 1;
    if (i === goal) break;
    const x = i % w, z = Math.floor(i / w);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
      const j = nz * w + nx;
      if (!nav.cells[j] || blocked?.[j] || closed[j]) continue;
      if (dx && dz && (!nav.cells[z * w + nx] || !nav.cells[nz * w + x])) continue; // no corner cutting
      const c = g[i] + (dx && dz ? Math.SQRT2 : 1) * cs * (penalty ? penalty[j] : 1);
      if (c < g[j]) { g[j] = c; parent[j] = i; push(c + heur(j), j); }
    }
  }
  if (parent[goal] < 0 && goal !== start) return null;
  const out: Point[] = [];
  for (let i = goal; i >= 0; i = parent[i]) out.push([nav.min[0] + ((i % w) + .5) * cs, nav.min[1] + (Math.floor(i / w) + .5) * cs]);
  return out.reverse();
}
const length = (r: Point[]) => r.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - r[i][0], p[1] - r[i][1]), 0);
/** Resample at 1 m. */
function samples(r: Point[]): Point[] {
  const out: Point[] = [r[0]];
  let carry = 0;
  for (let i = 1; i < r.length; i++) {
    const d = Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]);
    for (let t = 1 - carry; t <= d; t += 1) out.push([r[i - 1][0] + ((r[i][0] - r[i - 1][0]) * t) / d, r[i - 1][1] + ((r[i][1] - r[i - 1][1]) * t) / d]);
    carry = (carry + d) % 1;
  }
  return out;
}
const near = (p: Point, q: Point, d: number) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= d;
/** Metres of route `a` that stay within `d` of route `b`. */
function sharedLength(a: Point[], b: Point[], d: number): number {
  const sb = samples(b);
  return samples(a).filter((p) => sb.some((q) => near(p, q, d))).length;
}
/** Second route: strongly penalise a corridor around the first so it only shares what it cannot avoid (gates, shared bottlenecks). */
function second(from: Point, to: Point, first: Point[], corridor = 3): Point[] | null {
  const penalty = new Float32Array(nav.width * nav.height).fill(1), cs = nav.cellSize, fs = samples(first);
  for (const p of fs) {
    for (let dz = -corridor; dz <= corridor; dz += cs) for (let dx = -corridor; dx <= corridor; dx += cs) {
      if (Math.hypot(dx, dz) > corridor) continue;
      const i = nav.index(p[0] + dx, p[1] + dz);
      if (i >= 0) penalty[i] = 8;
    }
  }
  return route(from, to, undefined, penalty);
}

/** Boxes that stop sight: >= 1.6 m tall and wider than a post/trunk (buildings, parked cars, fences, hedges, shells). */
const blockers = solid.filter((c) => c.aabb.max[1] >= 1.55 && (c.aabb.max[0] - c.aabb.min[0] >= 1.4 || c.aabb.max[2] - c.aabb.min[2] >= 1.4)).map((c) => c.aabb);
const distBox = (p: Point, a: Aabb) => Math.hypot(Math.max(a.min[0] - p[0], 0, p[0] - a.max[0]), Math.max(a.min[2] - p[1], 0, p[1] - a.max[2]));
function longestOpenStretch(r: Point[], reach = 6): number {
  let worst = 0, run = 0;
  for (const p of samples(r)) {
    if (blockers.some((b) => distBox(p, b) <= reach)) run = 0; else { run++; worst = Math.max(worst, run); }
  }
  return worst;
}

const pairs: [string, string][] = [['player-start', 'parcel-door'], ['parcel-door', 'lab-door'], ['lab-door', 'garage-door'], ['garage-door', 'fire-bay-trigger']];
const routes = new Map<string, { a: Point[]; b: Point[] | null }>();
for (const [from, to] of pairs) {
  const a = route(at(from), at(to))!;
  routes.set(`${from}>${to}`, { a, b: a ? second(at(from), at(to), a) : null });
}

describe('D-GROVE layout', () => {
  test('T-E19-04 @E19 @E19-AC04 layout JSON is valid and every placement is a known asset', () => {
    expect(validateLayout(layout, worldAssets)).toEqual([]);
  });

  test('T-E19-04 @E19 @E19-AC04 axis crossing takes 30-45 s at run speed (target 38 s)', () => {
    const r = route(at('edge-in-1'), at('edge-in-4'))!;
    expect(r).not.toBeNull();
    const seconds = (length(r) + 6) / RUN; // plus the 3 m between each entry point and the visible barrier
    expect(seconds).toBeGreaterThanOrEqual(30);
    expect(seconds).toBeLessThanOrEqual(45);
  });

  test('T-E19-04 @E19 @E19-AC04 every consecutive objective pair has two routes sharing < 30 % of their length', () => {
    for (const [from, to] of pairs) {
      const { a, b } = routes.get(`${from}>${to}`)!;
      expect(a, `${from}>${to} first`).not.toBeNull();
      expect(b, `${from}>${to} second`).not.toBeNull();
      const shared = sharedLength(b!, a, 1.8) / samples(b!).length;
      expect(shared, `${from}>${to} shared ${shared.toFixed(2)}`).toBeLessThan(0.3);
    }
  });

  test('T-E19-04 @E19 @E19-AC04 a return route from the garage (and the fire station) to the facility bike rack avoids the delivery path', () => {
    const delivery = route(at('parcel-door'), at('lab-bike-rack'))!;
    for (const from of ['garage-door', 'fire-bay-trigger']) {
      const back = route(at(from), at('lab-bike-rack'))!;
      expect(back, from).not.toBeNull();
      const retrace = sharedLength(back, delivery, 2.5);
      expect(retrace, `${from} retraces ${retrace} m of the delivery path`).toBeLessThanOrEqual(30);
    }
  });

  test('T-E19-04 @E19 @E19-AC04 every route has a sight-blocking collider within every 25 m', () => {
    const all: [string, Point[]][] = [['axis', route(at('edge-in-1'), at('edge-in-4'))!]];
    for (const [k, { a, b }] of routes) { all.push([`${k}:1`, a]); if (b) all.push([`${k}:2`, b]); }
    for (const [name, r] of all) expect(longestOpenStretch(r), name).toBeLessThanOrEqual(25);
  });

  test('T-E19-04 @E19 @E19-AC04 gameplay anchors are walkable and reachable from the start', () => {
    const reached = nav.flood(at('player-start'));
    const skip = /^(bike-start|alarm-car|lab-tech-spawn|lab-smoke|lab-nobike|garage-nobike|fire-nobike|carwash-bay|dumpster-\d$|dumpster-\d-end|gate-)/;
    for (const name of Object.keys(layout.anchors)) {
      if (skip.test(name)) continue;
      const p = at(name), i = nav.index(p[0], p[1]);
      expect(i >= 0 && nav.cells[i] === 1, `${name} walkable at ${p}`).toBe(true);
      expect(reached[i], `${name} reachable`).toBe(1);
    }
    for (const name of ['gate-1', 'gate-2', 'gate-3', 'dumpster-1', 'dumpster-2']) {
      const p = at(name), i = nav.index(p[0], p[1]);
      expect(i >= 0 && nav.cells[i] === 1, `${name} walkable at ${p}`).toBe(true);
    }
  });

  test('T-E19-04 @E19 @E19-AC04 no invisible walls: authored colliders sit on visible geometry and the map edge is sealed by visible barriers', () => {
    const inside = (a: Aabb, b: Aabb, pad: number) => a.min[0] >= b.min[0] - pad && a.max[0] <= b.max[0] + pad && a.min[2] >= b.min[2] - pad && a.max[2] <= b.max[2] + pad;
    const visible = ['planter', 'trash-bag', 'gnome', 'crate', 'cafe-table', 'sec-fence']; // authored boxes that are merged meshes in the layout GLB
    for (const c of layout.colliders) {
      if (!c.id.startsWith('dressing:')) continue;
      const name = c.id.split(':')[1];
      const hit = visible.includes(name) || layout.placements.some((p) => inside(c.aabb, p.visualAabb, 0.3));
      expect(hit, `${c.id} has no visible geometry`).toBe(true);
    }
    // nothing the player can reach is within 1 m of the (invisible) district bounds
    const reached = nav.flood(at('player-start'));
    const xs = layout.bounds.map((p) => p[0]), zs = layout.bounds.map((p) => p[1]);
    const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    const leaks: string[] = [];
    for (let i = 0; i < reached.length; i++) {
      if (!reached[i]) continue;
      const x = nav.min[0] + ((i % nav.width) + .5) * nav.cellSize, z = nav.min[1] + (Math.floor(i / nav.width) + .5) * nav.cellSize;
      if (Math.min(x - x0, x1 - x, z - z0, z1 - z) < 1.0) leaks.push(`${x.toFixed(1)},${z.toFixed(1)}`);
    }
    expect(leaks.slice(0, 8), 'reachable ground within 1 m of the district bounds').toEqual([]);
  });

  test('T-E19-04 @E19 @E19-AC04 no overlapping solid props (colliders, 0.15 m tolerance)', () => {
    // pieces of one authored wall set (shell walls) or one placement's compound boxes never count against each other
    const group = (id: string) => (id.startsWith('dressing:') && !/^dressing:(planter|trash-bag|gnome|crate|cafe-table|sec-fence|bus-stop)/.test(id) ? id.split(':')[1] : id.replace(/\/geometry-\d+$/, ''));
    // the annex door seal deliberately overlaps the model's own door-frame boxes
    const boxes = solid.filter((c) => !c.id.startsWith('dressing:annex-door-seal')).map((c) => ({ id: group(c.id), a: c.aabb }));
    const hits: string[] = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.id === b.id) continue;
      const dx = Math.min(a.a.max[0], b.a.max[0]) - Math.max(a.a.min[0], b.a.min[0]);
      const dz = Math.min(a.a.max[2], b.a.max[2]) - Math.max(a.a.min[2], b.a.min[2]);
      if (dx > 0.15 && dz > 0.15) hits.push(`${a.id} / ${b.id} (${dx.toFixed(2)} x ${dz.toFixed(2)})`);
    }
    expect(hits.slice(0, 12)).toEqual([]);
  });

  test('T-E19-04 @E19 @E19-AC04 narrow passages: alley necks and yard gates are <= 2.5 m wide', () => {
    for (const name of ['gate-1', 'gate-2', 'gate-3']) {
      const p = at(name);
      let width = 0;
      for (const dir of [-1, 1]) for (let d = .25; d < 5; d += .5) {
        const i = nav.index(p[0] + dir * d, p[1]);
        if (i >= 0 && nav.cells[i]) width += .5; else break;
      }
      expect(width + .8, `${name} opening`).toBeLessThanOrEqual(2.5);
    }
  });
  test('T-E19-04 @E19 @E19-AC04 every alarm car has a reachable standing point within 2.4 m (QA1-17)', () => {
    const reached = nav.flood(at('player-start'));
    for (let n = 1; n <= 4; n++) {
      const c = at(`alarm-car-${n}`);
      let best = Infinity;
      for (let dz = -3; dz <= 3; dz += .5) for (let dx = -3; dx <= 3; dx += .5) {
        const i = nav.index(c[0] + dx, c[1] + dz);
        if (i >= 0 && reached[i] && Math.hypot(dx, dz) < best) best = Math.hypot(dx, dz);
      }
      expect(best, `alarm-car-${n}`).toBeLessThanOrEqual(2.4);
    }
  });
});
