import { expect, test, vi } from 'vitest';
import { CrowdView } from '../../../src/render/CrowdView';
import { SpatialHash } from '../../../src/sim/spatial/SpatialHash';
import type { EntitySnapshot } from '../../../src/sim/world/types';

type Pose = { x: number; z: number; sourceX: number; sourceZ: number; deadAt: number };
// Exercise production placement without loading render assets. The reference reproduces
// the old all-body separation predicate; candidate and support/visibility order stay identical.
function fixture(indexed: boolean) {
  const corpses = new Map<number, Pose>(), spatial = new SpatialHash();
  const world = { infected: { nav: { clear: (x: number, z: number) => Math.abs(x) < 30 && Math.abs(z) < 30, visible: () => true } }, districts: { supportBelow: (x: number) => x > 12 ? 3 : 0 } };
  const context = { corpses, corpseSpatial: spatial, corpseNeighbors: [], corpseQuery: { x: 0, z: 0, r: 1.25 }, world };
  if (!indexed) spatial.query = (q, result = []) => { result.length = 0; for (const id of corpses.keys()) result.push(id); return result; };
  const place = (CrowdView.prototype as unknown as { corpsePosition(this: typeof context, e: EntitySnapshot, tick: number): Pose }).corpsePosition;
  return { corpses, spatial, place: (e: EntitySnapshot, tick: number) => place.call(context, e, tick) };
}
function body(id: number, x: number, z: number, y = .7): EntitySnapshot { return { id, transform: { x, y, z, yaw: id * 2.399963 } } as EntitySnapshot; }

test('indexed death placement matches the full scan in dense piles, negative cells, support edges and moved IDs', () => {
  const indexed = fixture(true), reference = fixture(false);
  for (let id = 1; id <= 600; id++) {
    const e = body(id, (id % 17 - 8) * .73, (Math.floor(id / 17) % 11 - 5) * .81);
    expect(indexed.place(e, 12)).toEqual(reference.place(e, 12));
  }
  for (const e of [body(3, -18, -18), body(4, 12.1, 0, 3.7), body(5, 11.9, 0), body(6, 30, 30)]) {
    expect(indexed.place(e, 20)).toEqual(reference.place(e, 20));
    expect(indexed.place(e, 20)).toBe(indexed.corpses.get(e.id));
  }
  indexed.corpses.delete(3); indexed.spatial.delete(3); reference.corpses.delete(3);
  expect(indexed.place(body(601, -18, -18), 30)).toEqual(reference.place(body(601, -18, -18), 30));
});

test('permanent separated corpses query local neighbors instead of copying every retained entry', () => {
  const f = fixture(true);
  // Isolate neighbor work from nav/support: exact separation remains 1.25 m.
  for (let id = 1; id <= 2000; id++) { const p = { x: id * 5, z: -id * 5, sourceX: id * 5, sourceZ: -id * 5, deadAt: 1 }; f.corpses.set(id, p); f.spatial.set(id, p.x, p.z); }
  expect(f.spatial.query({ x: 5000, z: -5000, r: 1.25 })).toEqual([1000]);
  const iterate = vi.spyOn(f.corpses, Symbol.iterator);
  expect(f.place(body(2001, 0, 0), 2)).toMatchObject({ x: 0, z: 0 });
  expect(iterate).not.toHaveBeenCalled();
  expect(f.corpses.size).toBe(2001);
});
