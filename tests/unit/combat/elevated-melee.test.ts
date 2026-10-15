import { expect, test } from 'vitest';
import { HitQuery, type CoverWall } from '../../../src/sim/combat/HitQuery';
import { EntityStore } from '../../../src/sim/world/EntityStore';
import { SpatialHash } from '../../../src/sim/spatial/SpatialHash';

test('@E21 melee on the highway starts at the attacker height and still obeys deck and wall cover', () => {
  const entities = new EntityStore(), spatial = new SpatialHash();
  const target = entities.create({ kind: 'infected', archetype: 'infected.runner', faction: 'infected', health: { current: 40, max: 40 }, transform: { x: 1.5, y: 6.4, z: 0, yaw: 0 } });
  spatial.set(target.id, 1.5, 0);
  const walls: CoverWall[] = [{ x: 0, y: 5.45, z: 0, halfX: 5, halfY: .25, halfZ: 5 }];
  const query = new HitQuery(entities, spatial, walls);
  const origin = { x: 0, y: 6.4, z: 0 }, aim = { x: 1, z: 0 };
  expect(query.melee(0, origin, aim, 2, 90, 3).map(e => e.id)).toEqual([target.id]);
  origin.y = .7;
  expect(query.melee(0, origin, aim, 2, 90, 3)).toEqual([]);
  target.transform.y = .7;
  expect(query.melee(0, origin, aim, 2, 90, 3).map(e => e.id)).toEqual([target.id]);
  origin.y = target.transform.y = 6.4;
  walls.push({ x: .9, y: 6.4, z: 0, halfX: .1, halfY: 1, halfZ: 2 });
  expect(query.melee(0, origin, aim, 2, 90, 3)).toEqual([]);
});
