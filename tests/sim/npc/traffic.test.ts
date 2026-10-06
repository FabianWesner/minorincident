import { expect, test } from 'vitest';
import { npcWorld, step, teleport } from './helpers';
test('T-E08-09 @E08 @E08-AC09 braking cars stop for player/civilian and cannot overlap crossing walkers', async () => {
  for (const panic of [false, true]) {
    const w = await npcWorld('turning-probe'); teleport(w, -20, 10);
    const carId = w.npcs!.traffic.spawn([{ x: -25, z: 0 }, { x: 25, z: 0 }], panic), car = w.entities.get(carId)!;
    step(w, 240); expect(car.traffic!.speed).toBeGreaterThan(5);
    const id = w.npcs!.civilians.spawn('cashier', { x: car.transform.x + car.traffic!.speed ** 2 / 12 + 3, z: 0 }, { child: true });
    for (let tick = 0; tick < 240; tick++) { w.update(); expect(Math.abs(w.entities.get(id)!.transform.x - car.transform.x)).toBeGreaterThanOrEqual(2.35); }
    expect(car.traffic!.stopped).toBe(true); const before = car.transform.x; step(w, 60); expect(car.transform.x).toBe(before);
    w.entities.get(id)!.hidden = true; w.spatial.delete(id); step(w, 120); expect(car.transform.x).toBeGreaterThan(before + 1);
    teleport(w, car.transform.x + 4, 0); step(w, 180); expect(car.traffic!.stopped).toBe(true); w.dispose();
  }
  const w = await npcWorld('turning-probe'); teleport(w, -20, 10);
  const carId = w.npcs!.traffic.spawn([{ x: -20, z: 0 }, { x: 20, z: 0 }]), walker = w.npcs!.civilians.spawn('jogger', { x: 0, z: -5 }, { waypoints: [{ x: 0, z: -5 }, { x: 0, z: 5 }] });
  for (let i = 0; i < 1800; i++) { w.update(); expect(w.npcs!.traffic.overlaps(w.entities.get(walker)!.transform)).toBe(false); }
  expect(w.entities.get(carId)!.health.current).toBe(100); w.dispose();
});
test('@E08 L5 spline convoy stops for blockage, resumes and respects HP', async () => {
  const w = await npcWorld('turning-probe'); teleport(w, -30, -20); const [id] = w.npcs!.traffic.convoy([{ x: -10, z: 0 }, { x: 0, z: 0 }, { x: 20, z: 0 }], 1), e = w.entities.get(id)!;
  const wall = { x: -6, y: 1, z: 0, halfX: .5, halfY: 1, halfZ: 2 }; w.events.emit({ type: 'world.blocker.changed', tick: w.tick, id: 999, blocked: true, wall }); step(w, 120); expect(e.convoy!.state).toBe('stop'); const before = e.transform.x; step(w, 60); expect(e.transform.x).toBe(before);
  w.events.emit({ type: 'world.blocker.changed', tick: w.tick, id: 999, blocked: false, wall }); step(w, 800); expect(e.convoy!.state).toBe('arrived'); expect(e.transform.x).toBeCloseTo(20, 1);
  const [other] = w.npcs!.traffic.convoy([{ x: -10, z: 5 }, { x: 20, z: 5 }], 1); w.entities.get(other)!.health.current = 0; step(w, 1); expect(w.entities.get(other)!.convoy!.state).toBe('destroyed'); expect(w.events.events().some(e => e.type === 'mission.failed')).toBe(true); w.dispose();
});
