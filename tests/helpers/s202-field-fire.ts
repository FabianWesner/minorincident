import { expect } from 'vitest';
import { FieldFire } from '../../src/sim/interact/FieldFire';
import { VegetationFire } from '../../src/sim/interact/VegetationFire';
import { avoidFieldFire } from '../../src/sim/npc/avoidFieldFire';
import type { Placement } from '../../src/levels/districts/types';

const crop = (id: string, x: number, assetId = 'veg.corn-block') => ({ id, assetId, position: [x, 0, 0], yaw: 0, scale: [1, 1, 1], minTier: 0, maxTier: 6, decor: true, allowRoad: false, lightGroup: 'decor', visualAabb: { min: [x - 1, 0, -1], max: [x + 1, 2, 1] } }) as Placement;

function checkS202Field0(): void {
  const placements = [crop('a', 0), crop('b', 10), crop('c', 20), crop('road', 0, 'road.asphalt')];
  const first = new FieldFire(placements), second = new FieldFire(placements);
  expect(first.ignite({ x: 0, z: 0 }, 10, .1)).toBe(1);
  expect(second.ignite({ x: 0, z: 0 }, 10, .1)).toBe(1);
  for (let tick = 10; tick <= 600; tick++) { first.update(tick); second.update(tick); }
  expect(first.snapshot()).toEqual(second.snapshot());
  expect(first.cells.map(c => c.state)).toEqual(['scorched', 'scorched', 'scorched']);
  const saved = first.snapshot(), restored = new FieldFire(placements);
  restored.restore(saved);
  restored.update(1000);
  expect(restored.cells.map(c => c.state)).toEqual(['scorched', 'scorched', 'scorched']);
}


function checkS202Field1(): void {
  const field = new FieldFire([crop('a', 0), crop('b', 10)], (a, b) => (a.x < 5 && b.x > 5) || (a.x > 5 && b.x < 5));
  expect(field.ignite({ x: 0, z: 0 }, 1, 15)).toBe(1);
  for (let tick = 1; tick < 600; tick++) field.update(tick);
  expect(field.cells.map(cell => cell.state)).toEqual(['scorched', 'intact']);
}


function checkS202Field2(): void {
  const cell = { id: 'crop', x: 10, z: 0, state: 'burning' as const, ignitedAt: 0 };
  const target = { x: 20, z: 0 };
  expect(avoidFieldFire({ x: 0, z: 0 }, target, [cell], () => true)).toEqual({ x: 8, z: -8 });
  expect(avoidFieldFire({ x: 0, z: 0 }, target, [cell], () => false)).toBeNull();
  expect(avoidFieldFire({ x: 0, z: 0 }, target, [{ ...cell, state: 'scorched' }], () => true)).toBe(target);
}


function checkS202Field3(): void {
  const cells = [{ id: 'a', x: 10, z: 0, state: 'burning' as const, ignitedAt: 0 }, { id: 'b', x: 8, z: -8, state: 'burning' as const, ignitedAt: 0 }];
  expect(avoidFieldFire({ x: 0, z: 0 }, { x: 20, z: 0 }, cells, () => true)).toEqual({ x: 8, z: 8 });
}


const placement = (id: string, assetId: string, x: number) => ({ id, assetId, position: [x, 0, 0] }) as Placement;

function checkS202Field4(): void {
  const fire = new VegetationFire([placement('tree', 'prop.tree', 0), placement('house', 'bld.house', 0), placement('dead-tree', 'prop.tree.dead', 0), placement('bush', 'prop.garden-bush-small', 0)]);
  fire.ignite({ x: 0, z: 0 }, 10, 2);
  expect(fire.objects).toHaveLength(3);
  expect(fire.objects[0].state).toBe('burning');
  fire.update(609); expect(fire.objects[0].state).toBe('burning');
  fire.update(610); expect(fire.objects[0].state).toBe('charred');
}


function checkS202Field5(): void {
  const fire = new VegetationFire(Array.from({ length: 40 }, (_, i) => placement(`tree-${i}`, 'prop.tree', i)));
  fire.ignite({ x: 0, z: 0 }, 0, 100);
  expect(fire.objects.filter(o => o.state === 'burning')).toHaveLength(32);
}


function checkS202Field6(): void {
  const fire = new VegetationFire([placement('near', 'prop.tree', 0), placement('across', 'prop.tree', 10)], (a, b) => a.x < 5 && b.x > 5);
  fire.ignite({ x: 0, z: 0 }, 0, 20);
  expect(fire.objects.map(o => o.state)).toEqual(['burning', 'intact']);
}

export function checkS202FieldFire(): void {
  checkS202Field0();
  checkS202Field1();
  checkS202Field2();
  checkS202Field3();
  checkS202Field4();
  checkS202Field5();
  checkS202Field6();
}
