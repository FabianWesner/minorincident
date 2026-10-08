import { readFileSync } from 'node:fs';
import { afterEach, expect, test } from 'vitest';
import { compositions } from '../../../src/levels/compositions';
import type { DistrictLayout, Point } from '../../../src/levels/districts/types';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { NavGrid } from '../../../src/sim/world/NavGrid';
import { arena, step } from '../combat/helpers';

function move(w: SimWorld, x: number, z: number) {
  const p = w.entities.get(1)!;
  Object.assign(p.transform, { x, z }); w.physics.playerBody!.setTranslation(p.transform, true);
  w.player!.locomotion.reset(); w.spatial.set(1, x, z); w.physics.update();
}
function press(w: SimWorld) {
  w.setInput({ interact: false }); step(w, 1);
  w.setInput({ interact: true }); step(w, 1);
}

for (const kind of ['gate', 'door', 'car-door'] as const) test(`${kind}: reopen from either face without leaving reach; held input never repeats`, async () => {
  const w = await arena(), nav = new NavGrid([-3, -3], [3, 3]); nav.cells.fill(1); w.interactables!.nav = nav;
  const id = w.interactables!.spawn(kind, { x: 0, z: 0 }, { radius: 1.8, halfX: .9, halfZ: .12 });
  const c = w.entities.get(id)!.interactable!;
  move(w, 0, -1); press(w); expect(c.open).toBe(true);
  for (const side of [-1, 1]) {
    move(w, 0, side); press(w); expect(c.open).toBe(false);
    expect(nav.walkable([0, 0])).toBe(false);
    step(w, 120); expect(c.open).toBe(false); // holding and standing cannot undo the close
    move(w, 0, -side); press(w); expect(c.open).toBe(true);
    expect(nav.walkable([0, 0])).toBe(true);
    expect(w.interactables!.walls).toHaveLength(0);
    w.clearInput(); w.setInput({ move: { x: 0, z: side } }); step(w, 35);
    expect(w.entities.get(1)!.transform.z * side).toBeGreaterThan(.5); // physically passable
    w.clearInput();
  }
});

let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
for (const level of ['L1', 'L2', 'L3']) test(`${level}: every interactive gate has a reachable walkable point on both faces, including restored closed gates`, async () => {
  world = new SimWorld(); await world.init();
  const composition = compositions[level];
  world.loadComposition(composition, composition.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8')) as DistrictLayout), 1);
  world.enableInfected();
  const w = world, nav = w.districts!.nav, ids = w.toys?.gateIds ?? [];
  expect(ids).toHaveLength(level === 'L3' ? 0 : 3);
  for (const id of ids) {
    const e = w.entities.get(id)!, c = e.interactable!, t = e.transform;
    const along = Math.abs(Math.sin(t.yaw)) > .7;
    // Checkpoint/carryover/NPC state: closed and still marked completed, without a prior exit from its ring.
    c.open = false; c.completed = true; c.progress = 1;
    w.interactables!.rebuildBlockers(); w.toys!.update();
    const faces: Point[] = [];
    for (const side of [-1, 1]) {
      const candidates: Point[] = [];
      for (let i = 0; i < nav.cells.length; i++) if (nav.cells[i]) {
        const p: Point = [nav.min[0] + (i % nav.width + .5) * nav.cellSize, nav.min[1] + (Math.floor(i / nav.width) + .5) * nav.cellSize];
        const normal = along ? p[0] - t.x : p[1] - t.z;
        if (normal * side > .55 && Math.hypot(p[0] - t.x, p[1] - t.z) < c.radius && w.infected!.nav.clear(p[0], p[1], .35)) candidates.push(p);
      }
      expect(candidates.length, `${level} gate ${id} face ${side}`).toBeGreaterThan(0);
      const p = candidates.sort((a, b) => Math.hypot(a[0] - t.x, a[1] - t.z) - Math.hypot(b[0] - t.x, b[1] - t.z))[0];
      const approach: Point = [p[0] + (along ? side : 0), p[1] + (along ? 0 : side)];
      expect(nav.flood(nav.clamp(approach))[nav.index(...p)], `${level} gate ${id} reachable face ${side}`).toBe(1);
      faces.push(p);
    }
    expect(w.toys!.los.clear({ x: faces[0][0], z: faces[0][1] }, { x: faces[1][0], z: faces[1][1] })).toBe(false);
    for (const [a, b] of [[faces[0], faces[1]], [faces[1], faces[0]]]) {
      move(w, a[0], a[1]); press(w); expect(c.open).toBe(true);
      press(w); expect(c.open).toBe(false);
      move(w, b[0], b[1]); press(w); expect(c.open).toBe(true);
      expect(w.toys!.los.clear({ x: a[0], z: a[1] }, { x: b[0], z: b[1] })).toBe(true);
      press(w); expect(c.open).toBe(false);
    }
  }
});
