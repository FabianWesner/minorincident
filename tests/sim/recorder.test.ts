import { expect, test } from 'vitest';
import { Recorder } from '../../src/input/Recorder';
import { emptyInput } from '../../src/input/InputFrame';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { stateHash } from '../../src/sim/world/stateHash';

test('T-E03-10 @E03 @E03-AC10 serialized recording replays identical sim state hashes at every tick', async () => {
  const original = new SimWorld(), replay = new SimWorld();
  await original.init(); await replay.init();
  original.loadScenario('empty', 42);
  const recorder = new Recorder(); recorder.start({ seed: 42, level: 'empty' });
  const hashes: string[] = [];
  const frame = emptyInput();
  try {
    for (let tick = 0; tick < 600; tick++) {
      frame.move.x = Math.sin(tick / 60); frame.move.z = Math.cos(tick / 60);
      frame.left.down = tick % 60 === 0; frame.left.held = tick % 60 < 30; frame.left.up = tick % 60 === 30;
      frame.selector = tick % 100 === 0 ? 1 : 0;
      recorder.capture(frame); original.applyInput(frame, 'keyboard'); original.update();
      hashes.push(stateHash(original.getState()));
    }
    const data = recorder.stop();
    const roundTrip = Recorder.parse(Recorder.serialize(data));
    expect(roundTrip.frames[0].move).toEqual({ x: 0, z: 1 }); // retained independently of reused frame
    expect(roundTrip).toEqual(data);
    replay.loadScenario(roundTrip.level, roundTrip.seed);
    recorder.play(roundTrip);
    for (const expected of hashes) {
      const next = recorder.next()!; replay.applyInput(next, 'keyboard'); replay.update();
      expect(stateHash(replay.getState())).toBe(expected);
      expect(replay.getState().input.frame).toEqual(next);
    }
    expect(recorder.next()).toBeNull();
    expect(replay.getState()).toEqual(original.getState());
    expect(() => Recorder.parse('{"version":99}')).toThrow();
    expect(() => Recorder.parse(JSON.stringify({ ...data, frames: [{ ...data.frames[0], move: { x: 'bad', z: 0 } }] }))).toThrow();
  } finally { original.dispose(); replay.dispose(); }
});
