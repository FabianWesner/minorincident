import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { Matrix4, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { expect, test } from 'vitest';
import { bakeInfected, civilianClips, framesPerClip } from '../../../src/render/characters/bakeInfected';
import { CrowdFootwork, CrowdLocomotion } from '../../../src/render/characters/CrowdLocomotion';
import { CrowdPosePalette } from '../../../src/render/characters/CrowdPosePalette';
import { cadenceStride, gaitShape } from '../../../src/render/characters/clips';
import { GaitPhase } from '../../../src/render/characters/GaitPhase';

test('crowd stance ankles travel at most 3 cm at actual walk/run speeds and headings @E07', async () => {
  const results: { asset: string; rootScale: number; clip: string; speed: number; beforeCm: number; afterCm: number }[] = [];
  for (const asset of ['npc.civilian-man-a', 'npc.civilian-woman-a', 'npc.lab-tech-a', 'inf.common-worker.lod1']) {
    const bytes = readFileSync(`public/assets/models/${asset}.glb`);
    const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const baked = bakeInfected(scene, [], false, civilianClips), palette = new CrowdPosePalette(baked.clip, 1);
    const loco = new CrowdLocomotion(scene, baked.clip);
    for (const rootScale of [1, .7]) for (const [name, speed] of [['npc-walk', 1.4], ['civ-flee', 4], ['infected-frail', 4.7], ['infected-lurch', 5.1], ['infected-sprint', 5.6]] as const) {
      const stride = cadenceStride(name, baked.strideScale * rootScale, speed), stance = loco.stance(name, stride, rootScale);
      let beforeCm = 0, afterCm = 0;
      for (const yaw of [0, Math.PI / 4, Math.PI / 2]) for (const side of ['L', 'R']) {
        const part = baked.clip.parts.indexOf(`foot${side}`), start = side === 'L' ? 0 : .5;
        const first = new Vector3(), correctedFirst = new Vector3();
        loco.reset(1);
        for (let i = 0; i <= 24; i++) {
          const phase = start + i / 24 * stance * .95;
          const frame = civilianClips.indexOf(name) * framesPerClip + phase * (framesPerClip - 1);
          const root = new Matrix4().makeRotationY(yaw).scale(new Vector3().setScalar(rootScale)).setPosition(Math.cos(yaw) * (phase - start) * stride, 0, -Math.sin(yaw) * (phase - start) * stride);
          const blend = palette.sample(1, name, frame, phase);
          // Measure the shipped atlas with its capped playback, before contact correction.
          const original = palette.pose(frame, blend[0], 1);
          const ankle = new Vector3().setFromMatrixPosition(new Matrix4().fromArray(original, part * 16)).applyMatrix4(root);
          if (!i) first.copy(ankle); beforeCm = Math.max(beforeCm, first.distanceTo(ankle) * 100);
          const row = palette.correct(1, frame, blend[0], 1, pose => loco.correct(1, pose, root, phase, name, baked.strideScale * rootScale, speed));
          const corrected = palette.pose(row, blend[0], 1);
          const foot = new Vector3().setFromMatrixPosition(new Matrix4().fromArray(corrected, part * 16)).applyMatrix4(root);
          if (!i) correctedFirst.copy(foot); afterCm = Math.max(afterCm, correctedFirst.distanceTo(foot) * 100);
        }
      }
      results.push({ asset, rootScale, clip: name, speed, beforeCm, afterCm });
    }
    palette.texture.dispose(); baked.geometry.dispose();
  }
  mkdirSync('test-results/epics/E07/crowd-feel', { recursive: true });
  writeFileSync('test-results/epics/E07/crowd-feel/feet.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
  for (const r of results) expect(r.afterCm, `${r.asset} ${r.clip}`).toBeLessThanOrEqual(3);
});

test('distance phase stays continuous when speed and stride change @E07', () => {
  const phase = new GaitPhase();
  const first = phase.sample(1, 200, 'infected-frail', .5, 4.7);
  const next = phase.sample(1, 200.001, 'infected-frail', .5, .4);
  expect((next - first + 1) % 1).toBeCloseTo(.001 / cadenceStride('infected-frail', .5, .4));
  expect(phase.sample(1, 200.001, 'infected-sprint', .5, 0)).toBe(next);
  expect(gaitShape['infected-frail'].stance).toBeGreaterThan(0);
});

// P1 PO "invisible zombie biting me": a running figure whose footwork starts with both feet past the short run
// stance had no foot to stand on, the pelvis filter computed Infinity - Infinity = NaN and the NaN stuck, so the
// GPU drew nothing for that infected (or pedestrian) for seconds while the sim kept it attacking.
test('crowd footwork entering mid-run never produces a non-finite pose @E07', async () => {
  const bytes = readFileSync('public/assets/models/npc.civilian-man-a.glb');
  const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const baked = bakeInfected(scene, [], false, civilianClips), palette = new CrowdPosePalette(baked.clip, 64);
  const footwork = new CrowdFootwork(64), loco = new CrowdLocomotion(scene, baked.clip, footwork);
  const bad: string[] = [];
  let id = 0;
  for (const [name, speed] of [['civ-flee', 4], ['infected-frail', 4.7], ['infected-lurch', 5.1], ['infected-sprint', 5.6], ['npc-walk', 1.4]] as const) for (let k = 0; k < 20; k++) {
    id++; const start = k / 20, stride = cadenceStride(name, baked.strideScale, speed);
    for (let i = 0; i < 30; i++) {
      const time = 10 + i / 60, phase = (start + i / 60 * speed / stride) % 1, x = i / 60 * speed;
      footwork.begin(time);
      const frame = civilianClips.indexOf(name) * framesPerClip + phase * (framesPerClip - 1);
      const root = new Matrix4().makeRotationY(.4).setPosition(x, 0, 0), blend = palette.sample(id, name, frame, time);
      const row = loco.present(id, palette, frame, blend, name, phase, root, baked.strideScale, speed, time, true, { lurch: 1 }, { drag: 0, dragFoot: 0 });
      if (!palette.pose(row, blend[0], blend[1]).every(Number.isFinite)) bad.push(`${name} start ${start} frame ${i}`);
      // The footwork keeps solving (it is not dropped by the non-finite guard).
      if (!footwork.states.has(id)) bad.push(`${name} start ${start} frame ${i}: footwork dropped`);
    }
  }
  palette.texture.dispose(); baked.geometry.dispose();
  expect(bad).toEqual([]);
});
