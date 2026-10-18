import { expect, test, vi } from 'vitest';
import { SceneLab } from '../../../src/debug/scenelab/SceneLab';
import type { Action } from '../../../src/debug/scenelab/spec';

for (const seconds of [undefined, 1]) test(`@E26 @E24 Scene Lab interaction ${seconds === undefined ? 'press lasts one tick' : 'hold lasts exactly sixty ticks'}`, () => {
  const courier = { kind: 'courier', entity: 1, plan: null };
  const world = { entities: { get: () => ({ transform: { x: 0, z: 0 } }) }, setInput: vi.fn() };
  const lab = Object.assign(Object.create(SceneLab.prototype), {
    game: { world, input: { inject: vi.fn() } }, actors: new Map([['courier', courier]]), frame: 10,
  }) as { frame: number; command(id: string, action: Action): void; drivePlayer(): void };
  lab.command('courier', { interact: true, seconds });
  const duration = seconds === undefined ? 1 : 60;
  for (let tick = 0; tick <= duration; tick++) {
    lab.frame = 10 + tick; lab.drivePlayer();
    expect(world.setInput.mock.lastCall![0].interact).toBe(tick < duration);
  }
  expect(courier.plan).toBeNull();
});
