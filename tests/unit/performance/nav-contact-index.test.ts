import { expect, test } from 'vitest';
import { NavGrid, type Wall } from '../../../src/sim/ai/NavGrid';

test('route buckets retain ground navigation while solid queries keep all height layers and stable IDs', () => {
  const walls: Wall[] = [
    { x: 0, z: 0, y: .8, halfX: 1, halfZ: 1, halfY: .8 },
    { x: 3, z: 0, y: 3, halfX: 1, halfZ: 1, halfY: .5 },
    { x: -3, z: 0, y: -1, halfX: 1, halfZ: 1, halfY: .2 },
    { x: 0, z: 3, y: 5, halfX: 1, halfZ: 1, halfY: .5, navBlocker: true },
  ];
  const ground = { width: 20, depth: 20 };
  const nav = new NavGrid(ground, walls);
  const reference = new NavGrid(ground, walls.filter(w => w.navBlocker || w.y - w.halfY < 1.8 && w.y + w.halfY > .05));
  expect(nav.blocked).toEqual(reference.blocked);
  for (const radius of [0, .35, .9]) for (const rounded of [false, true]) {
    for (let x = -6; x <= 6; x += .25) for (let z = -6; z <= 6; z += .25) {
      expect(nav.clear(x, z, radius, rounded)).toBe(reference.clear(x, z, radius, rounded));
    }
    for (let x = -6; x <= 6; x += .5) expect(nav.visible({ x, z: -6 }, { x: -x, z: 6 }, radius)).toBe(reference.visible({ x, z: -6 }, { x: -x, z: 6 }, radius));
  }
  for (let i = 0; i < 2; i++) {
    const found = new Map<string, Wall>();
    nav.visitSolids(0, 0, 6, (wall, id) => { expect(found.has(id)).toBe(false); found.set(id, wall); });
    expect([...found.keys()].sort()).toEqual(walls.map((_, n) => `static:${n}`));
    for (const [id, wall] of found) expect(wall).toBe(walls[Number(id.slice(7))]);
  }
});
