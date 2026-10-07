import { expect, test } from 'vitest';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { emptyInput } from '../../src/input/InputFrame';
import { Recorder } from '../../src/input/Recorder';
import { stateHash } from '../../src/sim/world/stateHash';

test('T-E03-command-replay @E03 @E03-AC10 @E03-AC15 held target command reaches range, repeats and replays deterministically', async () => {
  const original = new SimWorld(), replay = new SimWorld();
  await original.init(); await replay.init();
  try {
    for (const world of [original, replay]) { world.loadScenario('combat-arena', 42); world.spawnDummy('infected.dummy', { x: 4, z: 0 }, { hp: 1000 }); }
    const recorder = new Recorder(); recorder.start({ seed: 42, level: 'combat-arena' });
    const hashes: string[] = [];
    for (let tick = 0; tick < 240; tick++) {
      const frame = emptyInput(); frame.left.held = tick < 180; frame.aimSource = 'pointer';
      if (tick === 0) { frame.attackTarget = { id: 2, side: 'LEFT' }; frame.left.down = true; }
      recorder.capture(frame); original.applyInput(frame, 'mouse-only'); original.update(); hashes.push(stateHash(original.getState()));
    }
    const attacks = original.events.events().filter(e => e.type === 'combat.attack');
    // E19 §5.6 bat knockback (2.6–3.3 m) forces a re-approach after every hit: two swings fit in 180 ticks.
    expect(attacks.length).toBeGreaterThanOrEqual(2); expect(attacks[0].tick).toBeLessThan(100);
    const stopped = original.getEntity(1)!.transform;
    expect(original.controls.snapshot()).toBeNull();
    recorder.play(recorder.stop());
    for (const hash of hashes) { replay.applyInput(recorder.next()!, 'mouse-only'); replay.update(); expect(stateHash(replay.getState())).toBe(hash); }
    for (let tick = 0; tick < 60; tick++) original.update();
    expect(original.getEntity(1)!.transform.x).toBeCloseTo(stopped.x, 4);
    const malformed = { version: 1, seed: 42, level: 'combat-arena', frames: [{ ...emptyInput(), attackTarget: { id: -1, side: 'LEFT' } }] };
    expect(() => Recorder.parse(JSON.stringify(malformed))).toThrow('Invalid .ssrec');
  } finally { original.dispose(); replay.dispose(); }
});

test('T-E03-target-swap @E03 @E03-AC15 @E03-AC17 a weapon swap does not consume a pending one-click target attack', async () => {
  const world = new SimWorld(); await world.init(); world.loadScenario('combat-arena');
  try {
    const id = world.spawnDummy('infected.dummy', { x: 1, z: 0 }, { hp: 1000 });
    for (let tick = 0; tick < 60; tick++) {
      const frame = emptyInput();
      if (tick === 0) { frame.attackTarget = { id, side: 'LEFT' }; frame.left.down = true; frame.selector = 1; }
      world.applyInput(frame, 'mouse-only'); world.update();
    }
    const attacks = world.events.events().filter(e => e.type === 'combat.attack');
    expect(attacks).toHaveLength(1); expect(attacks[0]).toMatchObject({ actionId: 'weapon.pistol', side: 'LEFT' }); expect(attacks[0].tick).toBeGreaterThanOrEqual(16);
    expect(world.getEntity(id)!.health.current).toBeLessThan(1000);
  } finally { world.dispose(); }
});
