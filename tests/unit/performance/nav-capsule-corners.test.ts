import { expect, test } from 'vitest';
import { NavGrid } from '../../../src/sim/ai/NavGrid';

test('@E22 capsule movement escapes a valid rounded collider corner in every quadrant', () => {
  const nav = new NavGrid({ width: 20, depth: 20 }, [{ x: 0, y: 1, z: 0, halfX: 1, halfY: 1, halfZ: 1 }]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const position = { x: sx * 1.255, z: sz * 1.255 };
    expect(nav.clear(position.x, position.z, .35, true)).toBe(true);
    expect(nav.clear(position.x, position.z, .37)).toBe(false);
    const before = { ...position };
    nav.move(position, sx * .01, sz * .01, .37);
    expect(sx * (position.x - before.x)).toBeGreaterThan(0);
    expect(sz * (position.z - before.z)).toBeGreaterThan(0);
    // Rounded recovery must still refuse a step through the solid corner.
    nav.move(position, -sx * .1, -sz * .1, .35);
    expect(nav.clear(position.x, position.z, .35, true)).toBe(true);
  }
});
