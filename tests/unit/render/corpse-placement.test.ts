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

test('native and civilian corpses share bounded settling with distinct raised heap layers', () => {
  const f = fixture();
  expect(corpseLayout(f.world)).toBe(f.layout);
  for (let id = 2; id <= 111; id++) {
    const e = body(id, (id % 7 - 3) * .4, (id % 11 - 5) * .4); f.records.set(id, e); f.layout.place(e);
  }
  const audit = f.layout.audit();
  expect(audit).toMatchObject({ count: 110, sunkPairs: 0, repeatedPairs: 0, courierClear: true });
  expect(audit.heapPairs).toBeGreaterThan(0);
  expect(audit.maxDisplacementM).toBeLessThanOrEqual(1.000001);
  expect(audit.maxLiftM).toBeGreaterThan(0);
});

test('settled bodies keep the courier feet clear as she walks through the field', () => {
  const f = fixture(), e = body(12, 0, 0); f.records.set(e.id, e);
  const first = f.layout.place(e);
  Object.assign(f.courier, { x: first.x, z: first.z });
  const moved = f.layout.place(e);
  expect(Math.hypot(moved.x - f.courier.x, moved.z - f.courier.z)).toBeGreaterThanOrEqual(.95);
  expect(moved.x === first.x && moved.z === first.z).toBe(false);
  expect(e.transform).toMatchObject({ x: 0, z: 0 });
});

test('a crowded doorway keeps every corpse within one metre instead of searching another floor region', () => {
  const f = fixture();
  Object.assign(f.world.infected!.nav, { clear: () => false });
  for (let id = 2; id < 12; id++) { const e = body(id, 0, 0); f.records.set(id, e); f.layout.place(e); }
  expect(f.layout.audit()).toMatchObject({ count: 10, sunkPairs: 0, repeatedPairs: 0 });
  expect(f.layout.audit().maxDisplacementM).toBeLessThanOrEqual(1.000001);
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
