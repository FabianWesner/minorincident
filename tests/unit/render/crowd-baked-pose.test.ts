import { expect, test } from 'vitest';
import { Matrix4 } from 'three';
import { load } from '../../../tools/crowdfoot/harness';
import { bakeInfected, civilianClips, framesPerClip } from '../../../src/render/characters/bakeInfected';
import { CrowdFootwork, CrowdLocomotion } from '../../../src/render/characters/CrowdLocomotion';
import { CrowdPosePalette } from '../../../src/render/characters/CrowdPosePalette';

test('baked crowd band keeps continuous finite poses, stops pose uploads and resumes nearby footwork', async () => {
  const model = await load('npc.civilian-man-a'), baked = bakeInfected(model, [], false, civilianClips);
  const poses = new CrowdPosePalette(baked.clip, 2), feet = new CrowdFootwork(4), locomotion = new CrowdLocomotion(model, baked.clip, feet);
  const transform = new Matrix4(), clip = 'infected-lurch';
  let farVersion = 0;
  try {
    for (let tick = 1; tick <= 360; tick++) {
      const time = tick / 60, far = tick > 60 && tick <= 300, phase = (time * 1.5) % 1;
      const source = civilianClips.indexOf(clip) * framesPerClip + phase * (framesPerClip - 1);
      const blend = poses.sample(1, far ? `${clip}:baked` : clip, source, time);
      transform.makeTranslation(time * 2.5, 0, 0); feet.begin(time);
      const frame = locomotion.present(1, poses, source, blend, clip, phase, transform, baked.strideScale, 2.5, time, !far, undefined, undefined, !far);
      expect(poses.pose(frame, blend[0], blend[1]).every(Number.isFinite)).toBe(true);
      if (far) expect(feet.count).toBe(0); else expect(feet.count).toBeGreaterThan(0);
      if (tick === 100) farVersion = poses.texture.version;
      if (tick > 100 && far) { expect(frame).toBe(source); expect(poses.texture.version).toBe(farVersion); }
    }
  } finally { poses.texture.dispose(); baked.geometry.dispose(); }
});

test('blocked phone figures hold the complete world pose between solves and an action updates immediately', async () => {
  const model = await load('npc.civilian-man-a'), baked = bakeInfected(model, [], false, civilianClips);
  const poses = new CrowdPosePalette(baked.clip, 2), feet = new CrowdFootwork(4), locomotion = new CrowdLocomotion(model, baked.clip, feet);
  const transform = new Matrix4(), previousTransform = new Matrix4();
  let previousPose: Float32Array = new Float32Array();
  let solved = 0, held = 0, version = 0;
  try {
    for (let tick = 1; tick <= 120; tick++) {
      const time = tick / 60, phase = time / 2 % 1;
      const source = civilianClips.indexOf('infected-idle') * framesPerClip + phase * (framesPerClip - 1);
      const blend = poses.sample(1, 'infected-idle', source, time);
      transform.makeTranslation(time * .05, 0, 0); feet.begin(time);
      const frame = locomotion.present(1, poses, source, blend, 'infected-idle', phase, transform, baked.strideScale, .05, time, true, undefined, undefined, true, 2);
      const pose = poses.pose(frame, blend[0], blend[1]);
      expect(pose.every(Number.isFinite)).toBe(true);
      if (!feet.count) {
        held++; expect(pose).toEqual(previousPose); expect(transform.elements).toEqual(previousTransform.elements); expect(poses.texture.version).toBe(version);
      } else solved++;
      previousPose = pose; previousTransform.copy(transform); version = poses.texture.version;
    }
    expect(held).toBeGreaterThanOrEqual(59); expect(solved).toBeGreaterThanOrEqual(59);
    // A root jump beyond five centimetres must solve even on its held parity.
    {
      const time = 122 / 60, phase = time / 2 % 1, source = civilianClips.indexOf('infected-idle') * framesPerClip + phase * (framesPerClip - 1);
      const blend = poses.sample(1, 'infected-idle', source, time); feet.begin(time - 1 / 120); feet.begin(time); transform.makeTranslation(.2, 0, 0);
      locomotion.present(1, poses, source, blend, 'infected-idle', phase, transform, baked.strideScale, 2, time, true, undefined, undefined, true, 2);
      expect(feet.count).toBeGreaterThan(0); expect(transform.elements[12]).toBe(.2);
    }
    const source = civilianClips.indexOf('windup') * framesPerClip, time = 123 / 60;
    const blend = poses.sample(1, 'windup', source, time); feet.begin(time - 1 / 120); feet.begin(time); transform.makeTranslation(.2, 0, 0);
    locomotion.present(1, poses, source, blend, 'windup', 0, transform, baked.strideScale, 0, time, true, undefined, undefined, true, 2);
    expect(feet.count).toBeGreaterThan(0); expect(transform.elements[12]).toBe(.2);
  } finally { poses.texture.dispose(); baked.geometry.dispose(); }
});
