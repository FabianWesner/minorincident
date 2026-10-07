import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { expect, test } from 'vitest';
import { QuadrupedAnimator } from '../../../src/render/characters/QuadrupedAnimator';
import { PawContacts } from '../../../src/render/characters/PawContacts';
import { authoredClips, cadenceStride, sampleClip, strideScale } from '../../../src/render/characters/clips';

test('corgi paws remain planted below the cadence cap in walk, trot and gallop', async () => {
  const results = [];
  for (const speed of [1.4, 3.8, 7]) {
    const bytes = readFileSync('public/assets/models/char.corgi.glb');
    const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const raw = scene.clone(true), rawProbe = new PawContacts(raw);
    const probe = new PawContacts(scene), animator = new QuadrupedAnimator(scene);
    animator.update(0, 0, 0); animator.update(1, speed, 0);
    const gait = animator.clip, stance = probe.stance(cadenceStride(gait, strideScale(scene), speed));
    let first: Vector3 | undefined, rawFirst: Vector3 | undefined, last = 1, maxCm = 0, beforeCm = 0, samples = 0;
    for (let i = 0; i < 600; i++) {
      const distance = speed * i / 240; scene.position.x = distance;
      animator.update(1 + i / 240, speed, distance);
      const phase = animator.gaitPhase, paw = new Vector3().fromArray(probe.points()[0]);
      raw.position.x = distance; sampleClip(raw, gait, phase * authoredClips.get(gait)!.duration);
      const original = new Vector3().fromArray(rawProbe.points()[0]);
      if (phase <= stance) {
        if (!first || phase < last) { first = paw.clone(); rawFirst = original.clone(); }
        maxCm = Math.max(maxCm, first.distanceTo(paw) * 100); samples++;
        beforeCm = Math.max(beforeCm, rawFirst!.distanceTo(original) * 100);
      } else first = undefined;
      last = phase;
    }
    results.push({ gait, speed, stance, samples, beforeCm, maxCm }); expect(samples).toBeGreaterThan(10); expect(maxCm).toBeLessThanOrEqual(3);
  }
  mkdirSync('test-results/crowd-feel', { recursive: true }); writeFileSync('test-results/crowd-feel/corgi-feet.json', JSON.stringify(results, null, 2));
});

test('instanced infected dog paws remain planted while the root travels', async () => {
  const { Matrix4 } = await import('three');
  const { bakeInfected, infectedClips, framesPerClip } = await import('../../../src/render/characters/bakeInfected');
  const { CrowdLocomotion } = await import('../../../src/render/characters/CrowdLocomotion');
  const { CrowdPosePalette } = await import('../../../src/render/characters/CrowdPosePalette');
  const bytes = readFileSync('public/assets/models/inf.dog-retriever.lod1.glb');
  const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const paws = new PawContacts(scene), local = scene.getObjectByName('legFL')!.worldToLocal(new Vector3().fromArray(paws.points()[0]));
  const baked = bakeInfected(scene, ['body', 'head', 'tail', 'legFL', 'legFR', 'legBL', 'legBR']), locomotion = new CrowdLocomotion(scene, baked.clip), palette = new CrowdPosePalette(baked.clip, 1);
  const stride = cadenceStride('run', baked.strideScale, 7), stance = paws.stance(stride), part = baked.clip.parts.indexOf('legFL');
  let first: Vector3 | undefined, maxCm = 0;
  for (let i = 0; i <= 24; i++) {
    const phase = i / 24 * stance * .95, frame = infectedClips.indexOf('run') * framesPerClip + phase * (framesPerClip - 1), root = new Matrix4().makeTranslation(phase * stride, 0, 0);
    const [outgoing] = palette.sample(1, 'run', frame, phase);
    const row = palette.correct(1, frame, outgoing, 1, pose => locomotion.correct(1, pose, root, phase, 'run', baked.strideScale, 7));
    const point = local.clone().applyMatrix4(new Matrix4().fromArray(palette.pose(row, outgoing, 1), part * 16)).applyMatrix4(root);
    first ??= point.clone(); maxCm = Math.max(maxCm, first.distanceTo(point) * 100);
  }
  expect(maxCm).toBeLessThanOrEqual(3); baked.geometry.dispose(); palette.texture.dispose();
});
