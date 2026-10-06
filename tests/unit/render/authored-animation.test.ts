import { readFileSync } from 'node:fs';
import { Box3, Matrix4, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, test } from 'vitest';
import { authoredClips, retargetClip, sampleClip, strides, strideScale } from '../../../src/render/characters/clips';
import { bakeInfected, framesPerClip, infectedClips } from '../../../src/render/characters/bakeInfected';
import { MotionPhase } from '../../../src/render/characters/MotionPhase';
import { resolveRig } from '../../../src/render/characters/rig';
import { KeyframeAnimator } from '../../../src/render/characters/KeyframeAnimator';
import { createSurvivorPlaceholder } from '../../../src/render/characters/placeholder';
import type { SurvivorState } from '../../../src/data/survivor';
import { createCorgiPlaceholder } from '../../../src/render/npc/placeholders';
import { QuadrupedAnimator } from '../../../src/render/characters/QuadrupedAnimator';

async function model(path: string) { const file = readFileSync(path); return new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), ''); }

test('M1-02 @E04 Blender glTF action library covers shared joints and distinct weapon/corgi moves', async () => {
  const library = await model('assets/animation-library/library.glb');
  expect(library.animations.map(c => c.name).sort()).toEqual([...authoredClips.keys()].sort());
  for (const name of ['walk','run','start','stop','turn-left','turn-right','shamble','infected-run','npc-walk','corgi-idle','corgi-walk','corgi-trot','corgi-sit']) expect(authoredClips.has(name)).toBe(true);
  for (const weapon of ['fists','bat','crowbar','machete']) {
    const strikes = [1,2,3].map(i => authoredClips.get(`${weapon}-${i}`)!);
    expect(new Set(strikes.map(c => JSON.stringify(c.tracks))).size).toBe(3);
    for (const strike of strikes) expect(strike.tracks.some(t => t.node.startsWith('arm') && t.path === 'rotation')).toBe(true);
  }
});

test('M1-02 @E04 stance feet stay planted while the authored pelvis and knee carry weight', async () => {
  const { scene } = await model('assets/char.survivor-female/model.glb');
  for (const scale of [1, 1.27642341, 1.27642341 * 1.25]) for (const name of ['walk','run']) {
    scene.scale.setScalar(scale);
    const duration = authoredClips.get(name)!.duration, points: Vector3[] = [];
    for (const phase of [0,.125,.25,.375]) { sampleClip(scene, name, phase * duration); scene.updateMatrixWorld(true); const foot = scene.getObjectByName('footL')!.getWorldPosition(new Vector3()); foot.x += strides[name] * strideScale(scene) * phase; points.push(foot); }
    expect(Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y))).toBeLessThan(.04 * scale);
    expect(Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x))).toBeLessThan(.035 * scale);
  }
});

test('M1-10 @E04 authored death poses flatten the full character and crowd matrices match the hierarchy', async () => {
  const { scene } = await model('assets/char.survivor-female/model.glb');
  const baked = bakeInfected(scene);
  const bounds = new Box3(), point = new Vector3(), matrix = new Matrix4();
  for (const name of ['death-back','death-side','death-crumple'] as const) {
    sampleClip(scene, name, authoredClips.get(name)!.duration); scene.updateMatrixWorld(true); bounds.setFromObject(scene);
    expect(bounds.max.y - bounds.min.y, name).toBeLessThan(.75); expect(bounds.min.y, name).toBeGreaterThanOrEqual(.014);
    const frame = infectedClips.indexOf(name) * framesPerClip + framesPerClip - 1;
    for (const node of ['hip','head','handR','footL']) {
      const part = baked.clip.parts.indexOf(node); matrix.fromArray(baked.clip.matrices, (frame * baked.clip.parts.length + part) * 16);
      point.setFromMatrixPosition(matrix); expect(point.distanceTo(scene.getObjectByName(node)!.getWorldPosition(new Vector3()))).toBeLessThan(.001);
    }
  }
  baked.geometry.dispose();
});

test('M1-02 @E04 speed phase stops for stationary NPCs and hero mixer preserves frozen ticks', () => {
  const phase = new MotionPhase(); phase.sample(1,0,0,0);
  const moving = { ...phase.sample(1,60,1,0) }; expect(moving.speed).toBe(1);
  const stopped = phase.sample(1,120,1,0); expect(stopped.speed).toBe(0); expect(stopped.distance).toBe(moving.distance);
  const root = createSurvivorPlaceholder('female'), rig = resolveRig(root), animator = new KeyframeAnimator(rig);
  const pose: SurvivorState = { variant:'female',gearTier:0,animation:'run',animationTick:0,velocity:{x:4.5,z:0},grounded:true,invulnerableUntil:0,checkpoint:{x:0,y:.7,z:0},diedAt:null };
  for (let tick=1;tick<=30;tick++) animator.update(pose,tick);
  const angle = rig.legL.quaternion.clone(); animator.update(pose,30); expect(rig.legL.quaternion.angleTo(angle)).toBeLessThan(.00001);
  expect(animator.clip).toBe('run'); expect(animator.missingClips).toBe(0);
  expect(retargetClip(root,'bat-1',true).tracks.every(t => !/^(hip|leg|shin|foot|root)/.test(t.name))).toBe(true);
});

test('M1-04 @E04 corgi trots on diagonal pairs and settles into an authored sit', () => {
  const root=createCorgiPlaceholder(), animator=new QuadrupedAnimator(root), body=root.getObjectByName('body')!, rest=body.position.y;
  animator.update(0,0,0);animator.update(.2,2,.1);animator.update(.3,2,strides['corgi-trot']*.5);
  expect(animator.clip).toBe('corgi-trot');
  const rotation=(name:string)=>root.getObjectByName(name)!.quaternion.clone().normalize();
  expect(rotation('legFL').angleTo(rotation('legBR'))).toBeLessThan(.0001);
  expect(rotation('legFR').angleTo(rotation('legBL'))).toBeLessThan(.0001);
  expect(rotation('legFL').angleTo(rotation('legFR'))).toBeGreaterThan(.2);
  animator.update(1,0,.2);expect(animator.clip).toBe('corgi-idle');
  animator.update(6,0,.2);expect(animator.clip).toBe('corgi-sit');expect(body.position.y).toBeLessThan(rest-.08);
});
