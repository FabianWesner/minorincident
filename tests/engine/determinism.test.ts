// Determinism is the engine's root contract: replays, telemetry, bots, checkpoints and every
// sim test depend on "same seed + same input = same state", independent of the render rate.
import { expect, test } from 'vitest';
import { Clock } from '../../src/core/Clock';
import { Recorder } from '../../src/input/Recorder';
import { emptyInput, type InputFrame } from '../../src/input/InputFrame';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { stateHash } from '../../src/sim/world/stateHash';
import { loadLevel, type RunnerLevel } from '../../tools/sim-runner/levels';

/** A square walk with periodic attacks, rack changes and interact presses: enough to touch movement, combat and props. */
function scripted(tick: number, frame: InputFrame = emptyInput()): InputFrame {
  const direction = Math.floor(tick / 60) % 4;
  frame.move.x = direction === 0 ? 1 : direction === 2 ? -1 : 0;
  frame.move.z = direction === 1 ? 1 : direction === 3 ? -1 : 0;
  frame.left = { down: tick % 45 === 0, held: tick % 45 < 20, up: tick % 45 === 20 };
  frame.selector = tick % 150 === 0 ? 1 : 0;
  return frame;
}

test('render rate does not change the simulation: 600 ticks hash the same at 30, 60 and 144 Hz', async () => {
  const hashes: string[] = [];
  for (const fps of [30, 60, 144]) {
    const world = new SimWorld(); await world.init(); world.loadScenario('empty', 1);
    try {
      const clock = new Clock();
      for (let frame = 0; frame < fps * 10; frame++) clock.advance(1 / fps, () => { world.applyInput(scripted(world.tick), 'keyboard'); world.update(); });
      expect(world.tick).toBe(600);
      hashes.push(stateHash(world.getState()));
    } finally { world.dispose(); }
  }
  expect(new Set(hashes).size).toBe(1);
});

test('a serialized recording replays the identical state hash at every tick; snapshots are copies; reset frees everything', async () => {
  const original = new SimWorld(), replay = new SimWorld();
  await original.init(); await replay.init();
  try {
    original.loadScenario('combat-arena', 42);
    const recorder = new Recorder(); recorder.start({ seed: 42, level: 'combat-arena' });
    const hashes: string[] = [], frame = emptyInput();
    for (let tick = 0; tick < 600; tick++) {
      scripted(tick, frame); recorder.capture(frame); original.applyInput(frame, 'keyboard'); original.update();
      hashes.push(stateHash(original.getState()));
    }
    const data = recorder.stop(), roundTrip = Recorder.parse(Recorder.serialize(data));
    expect(roundTrip).toEqual(data);
    replay.loadScenario(roundTrip.level, roundTrip.seed); recorder.play(roundTrip);
    for (const expected of hashes) {
      replay.applyInput(recorder.next()!, 'keyboard'); replay.update();
      expect(stateHash(replay.getState())).toBe(expected);
    }
    expect(recorder.next()).toBeNull();
    expect(replay.getState()).toEqual(original.getState());
    expect(() => Recorder.parse('{"version":99}')).toThrow();
    const state = replay.getState(); state.entities[0].transform.x = 999;
    expect(replay.getState().entities[0].transform.x).not.toBe(999);
    replay.reset();
    expect(replay.getState().perf).toEqual({ entities: 0, bodies: 0, colliders: 0, listeners: 0 });
  } finally { original.dispose(); replay.dispose(); }
});

// One short script over real levels (streets, interiors, vehicles, scripted missions): two runs with the
// same seed agree at every checkpoint, a different seed diverges.
test('real levels replay deterministically: same seed and script give the same hash on L1, L4 and L10', async () => {
  const levels: RunnerLevel[] = ['L1', 'L4', 'L10'];
  for (const level of levels) {
    const run = async (seed: number) => {
      const world = await loadLevel(level, seed), samples: string[] = [];
      try {
        for (let tick = 0; tick < 360; tick++) { world.applyInput(scripted(tick), 'keyboard'); world.update(); if (tick % 60 === 59) samples.push(stateHash(world.getState())); }
        return samples;
      } finally { world.dispose(); }
    };
    const a = await run(1), b = await run(1);
    expect(a, level).toEqual(b);
    if (level === 'L1') expect((await run(2)).at(-1), 'another seed diverges').not.toBe(a.at(-1));
  }
}, 240_000);
