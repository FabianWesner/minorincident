import { expect, test, vi } from 'vitest';
import { CorpseLayout, corpseLayout } from '../../../src/render/characters/CorpseLayout';
import type { SimWorld } from '../../../src/sim/world/SimWorld';
import type { EntitySnapshot } from '../../../src/sim/world/types';

function fixture() {
  const courier = { x: -20, z: -20 }, records = new Map<number, EntitySnapshot>();
  const world = { entities: { revision: 0, get: (id: number) => id === 1 ? { transform: courier } : records.get(id) },
    infected: { nav: { clear: (x: number, z: number) => Math.abs(x) < 30 && Math.abs(z) < 30, visible: () => true } },
    districts: { supportBelow: (x: number) => x > 12 ? 3 : 0 } } as unknown as SimWorld;
  return { courier, records, world, layout: corpseLayout(world) };
}
function body(id: number, x: number, z: number, y = .7): EntitySnapshot {
  return { id, health: { current: 0, max: 60 }, transform: { x, y, z, yaw: id * 2.399963 } } as EntitySnapshot;
}

test('native and civilian corpse pages share a non-overlapping ground layout', () => {
  const f = fixture();
  expect(corpseLayout(f.world)).toBe(f.layout);
  for (let id = 2; id <= 111; id++) {
    const e = body(id, (id % 7 - 3) * .4, (id % 11 - 5) * .4); f.records.set(id, e);
    const pose = f.layout.place(e);
    expect(f.world.infected!.nav.clear(pose.x, pose.z, .38)).toBe(true);
  }
  const poses = [...f.layout.bodies.values()];
  expect(poses).toHaveLength(110);
  // Probe the full body strips, including crossing bodies with distant roots.
  for (let i = 0; i < poses.length; i++) for (let j = 0; j < i; j++) {
    const a = poses[i], b = poses[j];
    for (let s = 0; s <= 10; s++) for (let t = 0; t <= 10; t++)
      expect(Math.hypot(a.ax + (a.bx - a.ax) * s / 10 - b.ax - (b.bx - b.ax) * t / 10, a.az + (a.bz - a.az) * s / 10 - b.az - (b.bz - b.az) * t / 10)).toBeGreaterThanOrEqual(1.2 - 1e-8);
  }
});

test('settled bodies keep the courier feet clear as she walks through the field', () => {
  const f = fixture(), e = body(12, 0, 0); f.records.set(e.id, e);
  const first = f.layout.place(e);
  Object.assign(f.courier, { x: first.x, z: first.z });
  const moved = f.layout.place(e);
  expect(Math.hypot(moved.x - f.courier.x, moved.z - f.courier.z)).toBeGreaterThanOrEqual(1.1);
  expect(moved.x === first.x && moved.z === first.z).toBe(false);
  expect(e.transform).toMatchObject({ x: 0, z: 0 });
});

test('settling can use connected floor around props without touching the AI path workspace', () => {
  const f = fixture(), e = body(12, 0, 0); f.records.set(e.id, e);
  Object.assign(f.courier, { x: 0, z: 0 });
  Object.assign(f.world.infected!.nav, { revision: 0, width: 5, blocked: new Uint8Array(25), nearestCell: () => 0, cell: () => 24, visible: () => false });
  f.layout.place(e);
  expect(f.layout.audit()).toMatchObject({ count: 1, overlaps: 0, courierClear: true, unplaced: [] });
});

test('settling cannot use a floor region separated by a solid wall', () => {
  const f = fixture(), e = body(12, 0, 0); f.records.set(e.id, e);
  Object.assign(f.courier, { x: 0, z: 0 });
  const blocked = new Uint8Array(25); for (let z = 0; z < 5; z++) blocked[z * 5 + 2] = 1;
  Object.assign(f.world.infected!.nav, { revision: 0, width: 5, blocked, nearestCell: () => 0, cell: () => 24, visible: () => false });
  f.layout.place(e);
  expect(f.layout.bodies.get(e.id)!.fit).toBe(false);
});

test('stable bodies retain their placement without repeated navigation work; restores release old footprints', () => {
  const f = fixture(), e = body(12, 0, 0); f.records.set(e.id, e);
  const first = f.layout.place(e), clear = vi.spyOn(f.world.infected!.nav, 'clear');
  expect(f.layout.place(e)).toBe(first); expect(clear).not.toHaveBeenCalled();
  f.records.delete(e.id); f.world.entities.revision++;
  const next = body(13, 0, 0); f.records.set(next.id, next); f.layout.place(next);
  expect(f.layout.bodies.has(e.id)).toBe(false);
  expect(new CorpseLayout(f.world).place(body(14, 14, 0, 3.7))).toMatchObject({ x: 14, z: 0 });
});
