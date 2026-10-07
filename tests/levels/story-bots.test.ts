import { expect, test } from 'vitest';
import { loadL1, runL1 } from '../../tools/sim-runner/l1Bots';

test.each([['complete', 1], ['complete', 2], ['newbie', 1]] as const)('@E19 PO UAT story beats: %s bot still completes L1 (seed %i)', async (policy, seed) => {
  const { world, mission } = await loadL1(seed);
  try {
    const report = runL1(world, mission, policy, { seed });
    expect(mission.state.l1!.beatsDone).toEqual(expect.arrayContaining(['pickup', 'handover', 'garage']));
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
    const started = world.tick; world.setInput({ left: { down: true, held: false, up: false } }); world.update(); world.clearInput(); world.update();
    expect(world.storyLock).toBeNull(); expect(mission.state.l1!.carrying).toBe(true); expect(world.tick - started).toBeLessThan(5);
  } finally { world.dispose(); }
}, 120_000);
