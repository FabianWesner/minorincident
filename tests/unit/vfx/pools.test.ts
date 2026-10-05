import { expect, test } from 'vitest';
import { FxPool } from '../../../src/render/vfx/FxPool';
import { HitStop } from '../../../src/render/vfx/HitStop';

test('T-E15-pool @E15 @E15-AC02 fixed slots reuse buffers and expire without resource churn', () => {
  const pool = new FxPool(8, 'ground');
  const geometry = pool.mesh.geometry, material = pool.mesh.material;
  for (let t = 0; t < 600; t++) {
    for (let i = 0; i < 100; i++) pool.spawn(t, 2, i, 0, 0, 0, 0, 0, 1, 0, 0xb3121f);
    pool.advance(t); expect(pool.count).toBeLessThanOrEqual(8);
    expect(pool.mesh.geometry).toBe(geometry); expect(pool.mesh.material).toBe(material);
  }
  pool.advance(602); expect(pool.count).toBe(0); pool.dispose();
});
test('T-E15-hit-stop @E15 @E15-AC06 render time owns the 50 ms freeze and crowds cancel it', () => {
  const stop = new HitStop(); stop.hit(0);
  expect(stop.active(0.049)).toBe(true); expect(stop.active(0.05)).toBe(false);
  for (let i = 0; i < 8; i++) stop.hit(1 + i * 0.02);
  expect(stop.active(1.14)).toBe(false); expect(stop.suppressed).toBe(1);
  stop.hit(1.5); expect(stop.active(1.549)).toBe(true);
  stop.reset(); expect(stop.active(1.5)).toBe(false);
});

test('T-E15-tell-slots @E15 @E15-AC04 long tells survive repeated short attacks', () => {
  const pool = new FxPool(8, 'ground');
  const persistent = pool.spawn(0, 100, 0, 0, 0, 0, 0, 0, 1, 1, 0x59e8ff, 0, 1, true);
  for (let i = 0; i < 40; i++) {
    const slot = pool.spawn(i, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0x59e8ff, 0, 1, true);
    expect(slot).not.toBe(persistent); pool.remove(slot);
  }
  pool.advance(40); expect(pool.count).toBe(1); pool.remove(persistent); expect(pool.count).toBe(0); pool.dispose();
});
