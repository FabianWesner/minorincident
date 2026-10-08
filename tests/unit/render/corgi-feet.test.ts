import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Mesh, Vector3, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { expect, test } from 'vitest';
import { QuadrupedAnimator } from '../../../src/render/characters/QuadrupedAnimator';
import { PawContacts } from '../../../src/render/characters/PawContacts';
import { authoredClips, cadenceStride, sampleClip, strideScale } from '../../../src/render/characters/clips';

test('corgi paws remain planted below the cadence cap in walk, trot and gallop @E07', async () => {
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
  mkdirSync('test-results/epics/E07/crowd-feel', { recursive: true }); writeFileSync('test-results/epics/E07/crowd-feel/corgi-feet.json', JSON.stringify(results, null, 2));
});

test('instanced infected dog paws remain planted while the root travels @E07', async () => {
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

test('corgi idle, sit and warning poses keep every paw and the rump on the floor (QA: sit hind paw 17.8 cm under) @E07', async () => {
  const bytes = readFileSync('public/assets/models/char.corgi.glb');
  const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const legs = ['legFL', 'legFR', 'legBL', 'legBR'], v = new Vector3();
  // Lowest vertex of a part, in cm (legs: the whole leg; body: the body without its legs, i.e. belly and rump).
  const lowest = (part: Object3D, skip: string[] = []) => {
    let y = Infinity; scene.updateWorldMatrix(true, true);
    part.traverse(n => {
      if (!(n instanceof Mesh)) return;
      for (let a: Object3D | null = n; a && a !== part; a = a.parent) if (skip.includes(a.name)) return;
      const p = n.geometry.attributes.position; for (let i = 0; i < p.count; i++) y = Math.min(y, v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld).y);
    });
    return y * 100;
  };
  const worst: Record<string, number> = {};
  for (const clip of ['corgi-idle', 'corgi-sit', 'corgi-stiffen', 'corgi-growl', 'corgi-bark', 'corgi-nervous']) {
    const duration = authoredClips.get(clip)!.duration;
    for (let i = 0; i <= 24; i++) {
      sampleClip(scene, clip, duration * i / 24);
      worst[clip] = Math.min(worst[clip] ?? Infinity, ...legs.map(n => lowest(scene.getObjectByName(n)!)), lowest(scene.getObjectByName('body')!, legs));
    }
  }
  for (const [clip, cm] of Object.entries(worst)) expect(cm, clip).toBeGreaterThanOrEqual(-1);
});

test('corgi paws do not skate by the Scene Lab rule through gaits, gait changes and stops (QA: corgi-follow slideMax 88 cm) @E07', async () => {
  const { Box3 } = await import('three');
  const { summarizeMotion } = await import('../../../src/debug/scenelab/motion');
  const bytes = readFileSync('public/assets/models/char.corgi.glb');
  const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const animator = new QuadrupedAnimator(scene), legs = ['legFL', 'legFR', 'legBL', 'legBR'].map(n => scene.getObjectByName(n)!);
  // Scene Lab paw point: lowest point of the leg meshes, fixed in leg space at the first frame.
  const local = legs.map(leg => { const b = new Box3(); leg.traverse(n => { if (n instanceof Mesh) b.expandByObject(n); }); const p = b.getCenter(new Vector3()); p.y = b.min.y; return leg.worldToLocal(p); });
  // Start, accelerate through walk/trot, brake hard to a stop, stand, then gallop with speed swings across the trot/gallop line.
  const speed = (i: number) => i < 60 ? 0 : i < 200 ? Math.min(4.5, (i - 60) * .1) : i < 260 ? Math.max(0, 4.5 - (i - 200) * .3) : i < 330 ? 0 : 6 - Math.abs(((i - 330) % 120) - 60) * .08;
  const frames = []; let distance = 0;
  for (let i = 0; i < 600; i++) {
    distance += speed(i) / 60; scene.position.x = distance; scene.updateMatrixWorld(true);
    animator.update(i / 60, speed(i), distance); scene.updateMatrixWorld(true);
    frames.push({ frame: i, floor: 0, feet: legs.map((leg, k) => { const p = leg.localToWorld(local[k].clone()).toArray(); return { heel: p, toe: p, yaw: 0 }; }) });
  }
  const motion = summarizeMotion(frames);
  expect(motion.slideMaxCm).toBeLessThanOrEqual(3); expect(motion.sinkMaxCm).toBeLessThanOrEqual(.5);
});
