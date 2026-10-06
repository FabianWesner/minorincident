import { expect, test } from 'vitest';
import { Physics } from '../../../src/physics/Physics';
import { GibPool } from '../../../src/render/vfx/GibPool';
import { Rng } from '../../../src/core/Rng';
test('E18 @E18 low tier keeps at most 30 active gibs and resets removed physics slots', async () => {
  await new Physics().init(); const pool = new GibPool(), rng = new Rng(1, 'gib-budget');
  try {
    for (let i = 0; i < 80; i++) pool.spawn(0, 0, 1, 0, rng); pool.advance(0, 1 / 60); expect(pool.count).toBe(80);
    pool.setQuality('low'); for (let i = 0; i < 80; i++) pool.spawn(0, 0, 1, 0, rng); pool.advance(0, 1 / 60);
    expect(pool.count).toBe(30); expect(pool.mesh.count).toBe(30); expect(pool.heads.count).toBe(30);
    pool.setQuality('high'); expect(pool.count).toBe(0); expect(pool.budget).toBe(80);
  } finally { pool.dispose(); }
});
