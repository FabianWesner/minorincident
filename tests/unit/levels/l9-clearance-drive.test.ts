import { expect, test } from 'vitest';
import { emptyInput } from '../../../src/input/InputFrame';
import { crossing } from '../../../src/levels/L9/district';
import { LevelNineBot } from '../../../src/debug/bot/LevelNineBot';
import { loadLevel } from '../../qa/invariants/world';

test('Q-131 APC drives forward through the reported off-lane tree/pole wedge without reversing', async () => {
  const world = await loadLevel('L9', 31, 'low');
  try {
    const car = world.vehicles!.cars.get(world.missions!.l9!.state.carId)!;
    car.physics.body.setTranslation({ x: -495, y: 1, z: 6 }, true);
    const input = { ...emptyInput(), drive: { throttle: .7, steer: 0 } };
    for (let tick = 0; tick < 10 * 60 && car.entity.transform.x < -450; tick++) { world.applyInput(input, 'keyboard'); world.update(); }
    expect(car.entity.transform.x, `APC stopped at ${car.entity.transform.x},${car.entity.transform.z}`).toBeGreaterThan(-450);
    expect(world.missions!.l9!.state.phase).toBe('driving');
  } finally { world.dispose(); }
}, 120_000);

for (const route of crossing.routes) test(`Q-131 ${route.id} APC drive tolerates small alternating steering offsets`, async () => {
  const world = await loadLevel('L9', 31, 'low');
  try {
    const mission = world.missions!.l9!, bot = new LevelNineBot(world, route.id);
    const car = world.vehicles!.cars.get(mission.state.carId)!;
    let stopped = 0, longestStop = 0;
    for (let tick = 0; tick < 260 * 60 && mission.state.phase === 'driving'; tick++) {
      const input = bot.sample();
      if (input.drive) input.drive.steer = Math.max(-1, Math.min(1, input.drive.steer + .08 * Math.sin(tick / 90)));
      world.applyInput(input, 'keyboard'); world.update();
      stopped = tick > 120 && Math.abs(car.physics.speed) < .15 ? stopped + 1 : 0;
      longestStop = Math.max(longestStop, stopped);
    }
    expect(mission.state.phase, `${route.id} stopped at ${car.entity.transform.x},${car.entity.transform.z}`).not.toBe('driving');
    expect(longestStop, `${route.id}: continuous stop while holding forward`).toBeLessThan(3 * 60);
  } finally { world.dispose(); }
}, 300_000);

test('Q-139 debug-entry APC drives forward from the reported 402,-16.8 wedge', async () => {
  const world = await loadLevel('L9', 1, 'low');
  try {
    const car = world.vehicles!.cars.get(world.missions!.l9!.state.carId)!;
    expect(world.solids.clear({ x: 402, y: 1, z: -16.8 }, 1.6, car.entity.id, false)).toBe(true);
    car.physics.body.setTranslation({ x: 402, y: 1, z: -16.8 }, true);
    const input = { ...emptyInput(), drive: { throttle: .7, steer: 0 } };
    for (let tick = 0; tick < 10 * 60 && car.entity.transform.x < 447; tick++) { world.applyInput(input, 'keyboard'); world.update(); }
    expect(car.entity.transform.x).toBeGreaterThan(447);
  } finally { world.dispose(); }
}, 120_000);
