import { expect, test } from 'vitest';
import { loadLevel } from '../../../tools/sim-runner/levels';
import { emptyInput } from '../../../src/input/InputFrame';

for (const [surface, z, cap] of [['road', -330, 18], ['rough', 100, 12]] as const) {
  for (const hp of [1000, 0]) test(`T-E31-09-terrain-${surface}-${hp} @E31-AC09 L9 ${surface} uses its healthy cap and a single 60% floor`, async () => {
    const w = await loadLevel('L9', 31);
    try {
      const car = w.vehicles!.cars.get(w.missions!.l9!.state.carId)!;
      car.physics.body.setTranslation({ x: -320, y: 1, z }, true);
      w.vehicles!.damage(car.entity.id, 1000 - hp);
      w.applyInput({ ...emptyInput(), drive: { throttle: 1, steer: 0 } }, 'keyboard');
      let top = 0;
      for (let i = 0; i < 900; i++) { w.update(); top = Math.max(top, car.physics.speed); }
      const expected = cap * (hp === 0 ? .6 : 1);
      expect(car.physics.speedCap).toBeCloseTo(expected / 18);
      expect(top).toBeGreaterThan(expected * (hp === 0 ? .98 : .9));
      expect(top).toBeLessThanOrEqual(expected * 1.02);
      expect(w.vehicles!.active).toBe(car.entity.id);
      expect(w.missions!.l9!.state.phase).toBe('driving');
    } finally { w.dispose(); }
  });
}
