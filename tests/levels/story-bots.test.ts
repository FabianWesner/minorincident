import { readTicks, storyLines } from '../../src/sim/missions/L1Story';
import { expect, test } from 'vitest';
import { loadL1, runL1 } from '../../tools/sim-runner/l1Bots';

test.each([['complete', 1], ['complete', 2], ['newbie', 1]] as const)('@E19 PO UAT story beats: %s bot still completes L1 (seed %i)', async (policy, seed) => {
  const { world, mission } = await loadL1(seed);
  try {
    const report = runL1(world, mission, policy, { seed });
    expect(mission.state.l1!.beatsDone).toEqual(expect.arrayContaining(['pickup', 'handover', 'garage', 'firestation']));
    expect(report.outcome ?? mission.state.phase).toBeTruthy();
    expect(['result', 'progression']).toContain(mission.state.phase);
  } finally { world.dispose(); }
}, 600_000);

test('@E19 PO UAT story beat locks input and any press skips it', async () => {
  const { world, mission } = await loadL1(1);
  try {
    const counter = mission.def.anchors['parcel-counter'], p = world.entities.get(1)!;
    Object.assign(p.transform, { x: counter.x, z: counter.z + 1.9 }); world.physics.playerBody!.setTranslation(p.transform, true); world.update();
    world.setInput({ interact: true }); world.update(); world.clearInput(); world.update();
    expect(mission.state.l1!.beat?.id).toBe('pickup'); expect(world.storyLock).not.toBeNull();
    const before = { ...world.entities.get(1)!.transform };
    world.setInput({ move: { x: 0, z: 0 } }); for (let i = 0; i < 10; i++) world.update(); // no press: still locked
    expect(world.storyLock).not.toBeNull(); expect(world.entities.get(1)!.transform.x).toBeCloseTo(before.x, 3);
    // PO: the bubble stays up for its reading time, max(2.5 s, 1 s + 70 ms/char)...
    const say = mission.state.l1!.say!; expect(say.until - say.at).toBe(readTicks(storyLines['pickup.clerk']));
    const click = () => { world.setInput({ left: { down: true, held: false, up: false } }); world.update(); world.clearInput(); world.update(); };
    // ...a first press completes the bubble (beat still running), a second press skips the beat.
    const started = world.tick; click();
    expect(world.storyLock).not.toBeNull(); expect(mission.state.l1!.say!.until).toBeLessThanOrEqual(world.tick);
    click();
    expect(world.storyLock).toBeNull(); expect(mission.state.l1!.carrying).toBe(true); expect(world.tick - started).toBeLessThan(6);
  } finally { world.dispose(); }
}, 120_000);

test('@E19 PO story beat holds until its bubble has been read', async () => {
  const { world, mission } = await loadL1(1);
  try {
    const counter = mission.def.anchors['parcel-counter'], p = world.entities.get(1)!;
    Object.assign(p.transform, { x: counter.x, z: counter.z + 1.9 }); world.physics.playerBody!.setTranslation(p.transform, true); world.update();
    world.setInput({ interact: true }); world.update(); world.clearInput();
    const say = mission.state.l1!.say!;
    let released = -1; for (let i = 0; i < 900 && released < 0; i++) { world.update(); if (!world.storyLock) released = world.tick; }
    expect(released).toBeGreaterThanOrEqual(say.until);
  } finally { world.dispose(); }
}, 120_000);
