import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { AnimationMixer, Box3, Matrix4, Mesh, Vector3, type AnimationAction } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { expect, test, vi } from 'vitest';
import { authoredClips, retargetClip, sampleClip, strides, strideScale } from '../../../src/render/characters/clips';
import { bakeInfected, framesPerClip, infectedClips } from '../../../src/render/characters/bakeInfected';
import { MotionPhase } from '../../../src/render/characters/MotionPhase';
import { resolveRig } from '../../../src/render/characters/rig';
import { KeyframeAnimator } from '../../../src/render/characters/KeyframeAnimator';
import { createSurvivorPlaceholder } from '../../../src/render/characters/placeholder';
import type { SurvivorState } from '../../../src/data/survivor';
import { createCorgiPlaceholder } from '../../../src/render/npc/placeholders';
import { QuadrupedAnimator } from '../../../src/render/characters/QuadrupedAnimator';
import manifest from '../../../src/assets/manifest.json';

async function model(path: string) { const file = readFileSync(path); return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), ''); }

test('M1-02 @E04 Blender glTF action library covers shared joints and distinct weapon/corgi moves', async () => {
  const library = await model('assets/animation-library/library.glb');
  expect(library.animations.map(c => c.name).sort()).toEqual([...authoredClips.keys()].sort());
  for (const name of ['walk','run','start','stop','turn-left','turn-right','shamble','infected-run','npc-walk','corgi-idle','corgi-walk','corgi-trot','corgi-sit']) expect(authoredClips.has(name)).toBe(true);
  for (const weapon of ['fists','bat','crowbar','machete']) {
    const strikes = [1,2,3].map(i => authoredClips.get(`${weapon}-${i}`)!);
    expect(new Set(strikes.map(c => JSON.stringify(c.tracks))).size).toBe(3);
    for (const strike of strikes) expect(strike.tracks.some(t => t.node.startsWith('arm') && t.path === 'rotation')).toBe(true);
  }
  sampleClip(library.scene,'npc-walk',authoredClips.get('npc-walk')!.duration*.25);
  const regular=library.scene.getObjectByName('head')!.quaternion.clone().normalize();
  sampleClip(library.scene,'npc-walk-relaxed',authoredClips.get('npc-walk-relaxed')!.duration*.25);
  expect(regular.angleTo(library.scene.getObjectByName('head')!.quaternion.clone().normalize())).toBeGreaterThan(.08);
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

test('M1-12 @E04 fixed authored guard rotations survive Blender export and retargeting', async () => {
  const { scene }=await model('assets/char.survivor-female/model.glb');
  sampleClip(scene,'bat-1',authoredClips.get('bat-1')!.duration);
  expect(scene.getObjectByName('armL')!.rotation.z).toBeGreaterThan(.3);
  expect(scene.getObjectByName('foreArmL')!.rotation.z).toBeGreaterThan(.5);
  sampleClip(scene,'run',authoredClips.get('run')!.duration*.25);
  expect(scene.getObjectByName('head')!.rotation.z).toBeGreaterThan(.12);
});

test('M1-10 @E04 authored death poses flatten the full character and crowd matrices match the hierarchy', async () => {
  const { scene } = await model('assets/char.survivor-female/model.glb');
  const baked = bakeInfected(scene);
  const bounds = new Box3(), point = new Vector3(), matrix = new Matrix4();
  for (const name of ['death-back','death-side','death-crumple'] as const) {
    sampleClip(scene, name, authoredClips.get(name)!.duration); scene.updateMatrixWorld(true); bounds.setFromObject(scene);
    // Lying on its side, the chibi head (~0.45 m wide) plus side ponytail sets the floor here.
    expect(bounds.max.y - bounds.min.y, name).toBeLessThan(.85); expect(bounds.min.y, name).toBeCloseTo(.015, 3);
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

test.each(['source', 'production'])('M1-25 @E04 grounded locomotion retains support across survivor and civilian rigs (%s)', async (delivery) => {
  // Catalog aliases share files; some entries only have a production model.
  // Avoid local generated directories, while still failing on missing declared files.
  const paths = new Set(manifest
    .filter(asset => (asset.id.startsWith('char.survivor-') || asset.id.startsWith('npc.')) && asset.requiredNodes?.some(node => node === 'shinL'))
    .map(asset => delivery === 'source' ? asset.sourceGlb : asset.glb)
    .filter((path): path is string => typeof path === 'string'));
  expect(paths.size).toBeGreaterThan(0);
  for (const id of paths) {
    const { scene } = await model(id);
    expect(scene.getObjectByName('shinL'), id).toBeDefined();
    const height = new Box3().setFromObject(scene).getSize(new Vector3()).y;
    for (const name of ['walk','run','npc-walk','npc-walk-relaxed']) {
      const duration = authoredClips.get(name)!.duration, stance = name === 'run' ? .5 : .6;
      const hips: number[] = [];
      for (let i = 0; i <= 120; i++) {
        sampleClip(scene, name, i / 120 * duration);
        hips.push(scene.getObjectByName('hip')!.getWorldPosition(new Vector3()).y);
      }
      const excursion = Math.max(...hips) - Math.min(...hips);
      expect(excursion / height, `${id} ${name} excursion`).toBeGreaterThan(.018);
      expect(excursion / height).toBeLessThan(name === 'run' ? .035 : .025);
      for (const [side, offset] of [['L',0],['R',.5]] as const) {
        const points: Vector3[] = [];
        for (let i = 0; i <= 60; i++) {
          const phase = i / 60 * stance;
          sampleClip(scene, name, (phase + offset) % 1 * duration);
          const point = scene.getObjectByName(`foot${side}`)!.getWorldPosition(new Vector3());
          point.x += phase * strides[name] * strideScale(scene); points.push(point);
        }
        for (const point of points) expect(point.distanceTo(points[0]), `${id} ${name} ${side} planted ankle`).toBeLessThan(.002);
      }
    }
  }
});

test('M1-25 @E04 survivor phase uses collision-resolved displacement rather than requested velocity', () => {
  const root = createSurvivorPlaceholder('female'), parent = root.clone(false); parent.add(root);
  const animator = new KeyframeAnimator(resolveRig(root));
  const pose: SurvivorState = { variant:'female',gearTier:0,animation:'run',animationTick:0,velocity:{x:4.5,z:0},grounded:true,invulnerableUntil:0,checkpoint:{x:0,y:.7,z:0},diedAt:null };
  for (let tick = 1; tick <= 60; tick++) { parent.position.x = tick / 60; animator.update(pose,tick); }
  expect(animator.clip).toBe('walk');
  for (let tick = 61; tick <= 90; tick++) animator.update(pose,tick);
  expect(animator.clip).toBe('idle');
});


test.each([
  { asset: 'placeholder', scale: 1 },
  { asset: 'char.survivor-female', scale: 1 },
  { asset: 'char.survivor-female', scale: 1.59 },
  { asset: 'char.survivor-male', scale: 1.59 },
])('M1-25 @E04 walk to run preserves support phase for $asset at world scale $scale', async ({ asset, scale }) => {
  const actionCalls = vi.spyOn(AnimationMixer.prototype, 'clipAction');
  const root = asset === 'placeholder' ? createSurvivorPlaceholder('female') : (await model(`assets/${asset}/model.glb`)).scene;
  const rig = resolveRig(root), parent = root.clone(false); parent.add(root); parent.scale.setScalar(scale);
  const animator = new KeyframeAnimator(rig);
  const pose: SurvivorState = { variant:'female',gearTier:0,animation:'run',animationTick:0,velocity:{x:4.5,z:0},grounded:true,invulnerableUntil:0,checkpoint:{x:0,y:.7,z:0},diedAt:null };
  const actions = actionCalls.mock.results.map(result => result.value as AnimationAction);
  const walk = actions.find(action => action.getClip().name === 'walk')!;
  const run = actions.find(action => action.getClip().name === 'run')!;
  for (let tick = 1; tick <= 60; tick++) { parent.position.x = tick / 60; animator.update(pose,tick); }
  const phase = walk.time / walk.getClip().duration;
  parent.position.x += 4.5 / 60; animator.update(pose,61);
  expect(animator.clip).toBe('run');
  expect(run.time / run.getClip().duration).toBeCloseTo((phase + 4.5 / 60 / (strides.run * strideScale(rig.root))) % 1, 6);
  expect(walk.time / walk.getClip().duration).toBeCloseTo(run.time / run.getClip().duration, 6);
  actionCalls.mockRestore();
});

test('@E03-AC20 seven authored unarmed silhouettes have sequenced anticipation, strike and follow-through', () => {
  const names = ['jab','cross','front-kick','roundhouse-kick','uppercut','knee','spinning-backfist'];
  const tracks = names.map(name => authoredClips.get(`unarmed-${name}`)!);
  expect(new Set(tracks.map(clip => JSON.stringify(clip.tracks))).size).toBe(7);
  for (const clip of tracks) {
    expect(clip.tracks.some(track => track.node === 'hip' && track.path === 'rotation')).toBe(true);
    expect(clip.tracks.some(track => track.node === 'torso' && track.path === 'rotation')).toBe(true);
    expect(clip.tracks.some(track => /^(arm|leg)/.test(track.node) && track.path === 'rotation')).toBe(true);
  }
});

test('M1-23 @E19 infection collapse and rise share a low pose, then rise into infected posture', async () => {
  const { scene } = await model('assets/npc.civilian-woman-a/model.glb');
  sampleClip(scene, 'infection-collapse', authoredClips.get('infection-collapse')!.duration);
  const low = new Box3().setFromObject(scene), head = scene.getObjectByName('head')!.getWorldPosition(new Vector3());
  sampleClip(scene, 'infection-rise', 0);
  expect(scene.getObjectByName('head')!.getWorldPosition(new Vector3()).distanceTo(head)).toBeLessThan(.01);
  expect(low.max.y).toBeLessThan(1);
  sampleClip(scene, 'infection-rise', authoredClips.get('infection-rise')!.duration);
  const upright = new Box3().setFromObject(scene);
  expect(upright.max.y - upright.min.y).toBeGreaterThan(low.max.y - low.min.y + .35);
  expect(scene.getObjectByName('torso')!.rotation.z).toBeLessThan(-.15);
  for (const name of ['infection-stagger','infection-collapse','infection-rise']) expect(infectedClips).toContain(name);
  const baked = bakeInfected(scene), eyes = baked.geometry.getAttribute('_emissive'), skin = baked.geometry.getAttribute('_shirt');
  expect(Array.from({ length: eyes.count }, (_, i) => eyes.getX(i)).filter(v => v > 0).length).toBeGreaterThan(0);
  expect(Array.from({ length: skin.count }, (_, i) => skin.getX(i)).filter(v => v < 0).length).toBeGreaterThan(0);
  baked.geometry.dispose();
});

test('VQA-13 @E19 settled infected death poses contact the floor across delivered rigs', async () => {
  for (const id of readdirSync('assets').filter(id => id.startsWith('inf.') && id !== 'inf.corpse-poses' && existsSync(`public/assets/models/${id}.glb`))) {
    const { scene } = await model(`public/assets/models/${id}.glb`);
    if (!scene.getObjectByName('hip')) continue;
    for (const name of ['death-back', 'death-side', 'death-crumple']) {
      sampleClip(scene, name, authoredClips.get(name)!.duration);
      const bounds = new Box3();
      scene.traverse(node => {
        if (!(node instanceof Mesh)) return;
        for (let parent: import('three').Object3D | null = node; parent; parent = parent.parent) if (!parent.visible || parent.name.startsWith('stump_')) return;
        node.geometry.computeBoundingBox();
        bounds.union(node.geometry.boundingBox!.clone().applyMatrix4(node.matrixWorld));
      });
      expect(bounds.min.y, `${id} ${name} ground contact`).toBeCloseTo(.015, 3);
      if (id === 'inf.common-worker' && name === 'death-back') {
        for (const part of ['handL', 'handR']) expect(scene.getObjectByName(part)!.getWorldPosition(new Vector3()).y, `${part} rests beside body`).toBeLessThan(.6);
        for (const part of ['footL', 'footR']) expect(scene.getObjectByName(part)!.getWorldPosition(new Vector3()).y, `${part} rests low`).toBeLessThan(.25);
      }
    }
  }
});
