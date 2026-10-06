import { expect, test } from 'vitest';
import { Physics } from '../../../src/physics/Physics';
import { KinematicController } from '../../../src/sim/locomotion/KinematicController';
import { moveAgent } from '../../../src/sim/locomotion/AgentMotion';
import { NavGrid } from '../../../src/sim/ai/NavGrid';
import type { EntitySnapshot } from '../../../src/sim/world/types';
import { emptyInput } from '../../../src/input/InputFrame';
import { intent, motion, rootMetrics } from '../../../src/debug/motionlab/Motion';
import { MotionPresentation } from '../../../src/render/characters/MotionPresentation';
import { CrowdPosePalette } from '../../../src/render/characters/CrowdPosePalette';
import { bakeInfected, framesPerClip, infectedClips } from '../../../src/render/characters/bakeInfected';
import { createInfectedPlaceholder } from '../../../src/render/characters/infectedPlaceholder';

test('stage1 navigation capsule and NPC traces meet motion budgets @smoke', async () => {
  const physics = new Physics(); await physics.init();
  physics.load({ name: 'motion-regression', survivor: true, ground: { width: 100, depth: 100 }, player: { x: 0, y: .7, z: 0 } });
  const controller = new KinematicController(physics), transform = { x: 0, y: .7, z: 0, yaw: 0 }, input = emptyInput();
  const speeds = [1.4, 2.4, 4.2, 6.5, 9];
  const traces: { x: number; z: number; yaw: number }[][] = Array.from({ length: speeds.length + 1 }, () => []), agents = speeds.map(() => motion()), nav = new NavGrid({ width: 100, depth: 100 }, []), entities = agents.map((_, id) => ({ id, transform: { x: 0, y: .7, z: 0, yaw: 0 } } as EntitySnapshot));
  try {
    for (let tick = 1; tick <= 720; tick++) {
      input.move = intent(tick); input.navigation = true; controller.move(input, transform, true); physics.update();
      Object.assign(transform, physics.playerBody!.translation()); traces[0].push({ ...transform });
      entities.forEach((entity, i) => { const command = intent(tick), speed = speeds[i]; moveAgent(entity, command.x * speed, command.z * speed, nav, tick); traces[i + 1].push({ ...entity.transform }); });
    }
    traces.forEach((trace, i) => {
      expect(rootMetrics(trace).jerkRmsMps3).toBeLessThanOrEqual(i ? 15 : 50);
      expect(rootMetrics(trace).turnPeakDegPerFrame).toBeLessThanOrEqual(6);
    });
  } finally { physics.dispose(); }
});

test('crowd fades preserve head position when clips change or interrupt @smoke', () => {
  const baked = bakeInfected(createInfectedPlaceholder('runner')), palette = new CrowdPosePalette(baked.clip, 1);
  const head = baked.clip.parts.indexOf('head') * 16;
  const sample = (clip: typeof infectedClips[number], time: number) => {
    const frame = infectedClips.indexOf(clip) * framesPerClip;
    return palette.pose(frame, ...palette.sample(1, clip, frame, time));
  };
  let previous = sample('idle', 0);
  for (const [clip, time] of [['run', 1 / 60], ['run', 2 / 60], ['hurt', 3 / 60], ['idle', 4 / 60]] as const) {
    const next = sample(clip, time);
    expect(Math.hypot(...[12, 13, 14].map(i => next[head + i] - previous[head + i]))).toBeLessThanOrEqual(.05);
    previous = next;
  }
  palette.texture.dispose(); baked.geometry.dispose();
});

test('presentation applies paused same-tick teleports and interpolates subsequent movement', () => {
  const presentation = new MotionPresentation(), transform = { x: 0, y: .7, z: 0, yaw: 0 };
  presentation.sample(1, transform, 10);
  transform.x = 1;
  expect(presentation.sample(1, transform, 10, .5).x).toBe(1);
  transform.x = 2;
  expect(presentation.sample(1, transform, 11, .5).x).toBe(1.5);
});
