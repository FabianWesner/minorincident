import { readFileSync } from 'node:fs';
import { Group, MeshLambertMaterial, Quaternion, SkinnedMesh, Vector3, type AnimationAction } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { expect, test, vi } from 'vitest';
import { alignSkeleton } from '../../../src/render/characters/skin';
import { resolveRig } from '../../../src/render/characters/rig';
import { KeyframeAnimator } from '../../../src/render/characters/KeyframeAnimator';
import { CharacterView } from '../../../src/render/characters/CharacterView';
import { RiderContacts, useSkinnedCourier } from '../../../src/render/characters/RiderContacts';
import { skinClips } from '../../../src/render/characters/clips';
import type { SurvivorState } from '../../../src/data/survivor';
import type { Materials } from '../../../src/render/Materials';
import { meleeMoves } from '../../../src/data/meleeCombos';

async function model(path: string) {
  const file = readFileSync(path);
  return (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '')).scene;
}
function pose(): SurvivorState { return { variant: 'female', gearTier: 0, animation: 'idle', animationTick: 0, velocity: { x: 0, z: 0 }, grounded: true, invulnerableUntil: 0, checkpoint: { x: 0, y: .7, z: 0 }, diedAt: null }; }

test('skin rollout retains explicit A/B overrides', () => {
  expect(useSkinnedCourier(new URLSearchParams())).toBe(false);
  expect(useSkinnedCourier(new URLSearchParams('skin=1'))).toBe(true);
  expect(useSkinnedCourier(new URLSearchParams('skin=0'))).toBe(false);
});

test.each(['female', 'male'] as const)('skin rollout plants %s stance feet with capped cadence @E04', async variant => { for (const speed of [2, 4.5]) {
  const scene = await model(`public/assets/models/char.courier-${variant}.skin.glb`);
  expect(alignSkeleton(scene)).toHaveLength(1);
  const rig = resolveRig(scene), actor = new Group(); actor.add(scene);
  const animator = new KeyframeAnimator(rig, skinClips), state = pose(); state.variant = variant;
  let samples = 0, maxSlide = 0, maxCadence = 0, previousPhase = -1, previous: Vector3 | undefined;
  for (let tick = 1; tick <= 240; tick++) {
    actor.position.x += speed / 60; state.velocity.x = speed; animator.update(state, tick); actor.updateMatrixWorld(true);
    const gait = (animator as unknown as { actions: Map<string, AnimationAction> }).actions.get(speed > 2.5 ? 'run' : 'walk')!;
    const phase = gait.time / gait.getClip().duration, foot = rig.footL.getWorldPosition(new Vector3());
    const stance = speed > 2.5 ? .22 : .5 - .28 * ((2 - 1.9) / (3.3 - 1.9)) ** 2 * (3 - 2 * (2 - 1.9) / (3.3 - 1.9));
    if (tick > 90 && previous && phase > previousPhase && phase < stance && previousPhase < stance) { samples++; maxSlide = Math.max(maxSlide, foot.distanceTo(previous)); }
    if (tick > 90) maxCadence = Math.max(maxCadence, ((phase - previousPhase + 1) % 1) * 60);
    previousPhase = phase; previous = foot;
  }
  expect(samples).toBeGreaterThan(15); expect(maxSlide).toBeLessThan(.001); expect(maxCadence).toBeLessThan(speed > 2.5 ? 3.201 : 2.511);
  const meshes: SkinnedMesh[] = []; scene.traverse(node => { if (node instanceof SkinnedMesh) meshes.push(node); });
  expect(meshes).toHaveLength(1);
  const before = rig.footL.getWorldPosition(new Vector3()); animator.update(state, 240); actor.updateMatrixWorld(true);
  expect(rig.footL.getWorldPosition(new Vector3()).distanceTo(before)).toBeLessThan(1e-6);
} });

test('skin pilot kick lunge recovers without accumulating mixer offsets @E04', async () => {
  const scene = await model('public/assets/models/char.courier-female.skin.glb'); alignSkeleton(scene);
  const rig = resolveRig(scene), animator = new KeyframeAnimator(rig, skinClips), state = pose();
  state.animation = 'kick'; state.animationTick = 1;
  state.attack = { actionId: 'weapon.kick', combo: 0, started: 1, activeAt: 8, recoveryAt: 12, endsAt: 31 };
  let farthest = 0;
  for (let tick = 1; tick <= 60; tick++) {
    if (tick === 31) { state.animation = 'idle'; delete state.attack; }
    animator.update(state, tick); farthest = Math.max(farthest, Math.abs(rig.hip.position.x));
  }
  expect(farthest).toBeLessThan(.3); expect(Math.abs(rig.hip.position.x)).toBeLessThan(.03);
});

test.each(['female', 'male'] as const)('skin rollout %s hands and soles follow bike sockets under heading, lean, steering and crank rotation @E04', async variant => {
  const loader = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(async path => ({ scene: await model(`public${path}`) }) as never);
  const material = () => Object.assign(new MeshLambertMaterial({ vertexColors: true }), { bloodCoverage: { value: 0 } });
  const materials = { fromVertexColors: material, fromColor: material, get: material, unique: material } as unknown as Materials;
  const character = new CharacterView();
  try {
    await character.init(materials, false, false, 'courier', true);
    const bike = await model('public/assets/models/veh.courier-bike.glb'); bike.scale.setScalar(.6); bike.rotation.set(.14, 1.2, 0);
    const targets = new RiderContacts(), state = pose(); state.variant = variant;
    const axis = new Vector3(0, 0, 1);
    let skin!: SkinnedMesh; const rigRoot = (character as unknown as { characters: Map<string, { model: Group }> }).characters.get(variant)!.model;
    rigRoot.traverse(node => { if (node instanceof SkinnedMesh) skin = node; });
    const handRotation = new Quaternion().setFromAxisAngle(axis, Math.PI / 2);
    for (let tick = 1; tick <= 90; tick++) {
      const pedal = tick * .075; bike.getObjectByName('crank')!.rotation.z = -pedal; bike.getObjectByName('handlebar')!.rotation.y = Math.sin(tick / 15) * .4;
      bike.updateMatrixWorld(true); bike.getWorldQuaternion(targets.orientation);
      for (const [name, node] of [['seat', 'seat'], ['handL', 'grip_l'], ['handR', 'grip_r'], ['footL', 'pedal_l'], ['footR', 'pedal_r']] as const) bike.getObjectByName(node)!.getWorldPosition(targets[name]);
      character.position.set(0, 0, 0); character.quaternion.identity(); character.update(state, tick, 1, { pedal, steer: 0 }); character.applyRideContacts(targets);
      if (tick < 30) continue;
      expect(character.getState().clip).toBe('ride'); expect(character.getState().missingClips).toBe(0);
      for (const side of ['L', 'R'] as const) {
        const hand = rigRoot.getObjectByName(`hand${side}`)!, socket = rigRoot.getObjectByName(`weaponSocket${side}`)!;
        expect(socket.getWorldPosition(new Vector3()).distanceTo(targets[`hand${side}`]), `${side} tick ${tick}`).toBeLessThan(.006);
        expect(hand.getWorldQuaternion(new Quaternion()).angleTo(targets.orientation.clone().multiply(handRotation))).toBeLessThan(.001);
        const foot = rigRoot.getObjectByName(`foot${side}`)!, sole = foot.getWorldPosition(new Vector3()).add(new Vector3(0, -character['riders'].get(variant)!.soleHeight, 0).applyQuaternion(targets.orientation));
        expect(sole.distanceTo(targets[`foot${side}`])).toBeLessThan(.006);
      }
      skin.skeleton.update();
    }
    const frozen = rigRoot.getObjectByName('handL')!.getWorldPosition(new Vector3());
    character.position.set(0, 0, 0); character.quaternion.identity(); character.update(state, 90, 1, { pedal: 90 * .075, steer: 0 }); character.applyRideContacts(targets); character.updateMatrixWorld(true);
    expect(rigRoot.getObjectByName('handL')!.getWorldPosition(new Vector3()).distanceTo(frozen)).toBeLessThan(1e-6);
    const gaze = rigRoot.getObjectByName('head')!.getWorldQuaternion(new Quaternion());
    for (let tick = 91; tick <= 150; tick++) {
      character.position.set(0, 0, 0); character.quaternion.identity(); character.update(state, tick, 1, { pedal: 90 * .075, steer: 0 }); character.applyRideContacts(targets); character.updateMatrixWorld(true);
      expect(rigRoot.getObjectByName('head')!.getWorldQuaternion(new Quaternion()).angleTo(gaze)).toBeLessThan(.001);
    }
    character.update(state, 151, 1); character.applyRideContacts(); expect(character.getState().clip).toBe('dismount');
    for (let tick = 152; tick <= 180; tick++) { character.position.set(0, 0, 0); character.update(state, tick, 1); character.applyRideContacts(); }
    expect(character.getState().rideWeight).toBe(0); expect(character.getState().clip).toBe('idle');
  } finally { character.dispose(); loader.mockRestore(); }
});

test.each(['female', 'male'] as const)('skin rollout %s keeps knees, turn reach and sharp-stop stance bounded @E04', async variant => {
  const scene = await model(`public/assets/models/char.courier-${variant}.skin.glb`); alignSkeleton(scene);
  const rig = resolveRig(scene), actor = new Group(); actor.add(scene);
  const animator = new KeyframeAnimator(rig, skinClips), state = pose(); state.variant = variant;
  let separation = 0, reach = 0, worstTick = 0;
  for (let tick = 1; tick <= 420; tick++) {
    const speed = tick <= 150 ? 2 : tick <= 300 ? 4.5 : tick <= 330 ? 2 : 0;
    const yaw = tick <= 300 ? 0 : Math.min(Math.PI, (tick - 300) * Math.PI / 12);
    actor.rotation.y = yaw; actor.position.x += Math.cos(yaw) * speed / 60; actor.position.z -= Math.sin(yaw) * speed / 60;
    state.velocity = { x: Math.cos(yaw) * speed, z: -Math.sin(yaw) * speed };
    animator.update(state, tick); actor.updateMatrixWorld(true);
    const feet = [];
    for (const side of ['L', 'R'] as const) {
      const hip = rig[`leg${side}`].getWorldPosition(new Vector3()), knee = rig[`shin${side}`].getWorldPosition(new Vector3()), ankle = rig[`foot${side}`].getWorldPosition(new Vector3());
      if (tick > 90 && tick < 150 || tick > 240 && tick < 300) {
        const flex = knee.clone().sub(hip).normalize().angleTo(ankle.clone().sub(knee).normalize()) * 180 / Math.PI;
        expect(flex).toBeLessThan(speed === 2 ? 25.5 : 45.1);
      }
      if (tick > 300) reach = Math.max(reach, hip.distanceTo(ankle));
      feet.push(ankle);
    }
    if (tick > 300 && feet[0].distanceTo(feet[1]) > separation) { separation = feet[0].distanceTo(feet[1]); worstTick = tick; }
    // A turn releases the old stance over 100 ms; requiring an instant narrow
    // stance would permit exactly the foot teleport this regression guards.
    if (tick > 307 && tick <= 312) expect(feet[0].distanceTo(feet[1])).toBeLessThan(.28);
    if (tick > 360) expect(feet[0].distanceTo(feet[1])).toBeLessThan(.23);
  }
  expect(reach).toBeLessThan((rig.shinL.position.length() + rig.footL.position.length()) * 1.001); expect(separation, `largest separation at ${worstTick}`).toBeLessThan(.56);
});

test.each(['female', 'male'] as const)('courier %s has continuous swing feet and bounded pelvis through the speed range @E04', async variant => {
  for (const speed of [.3, .8, 1.4, 2, 2.7, 3.3, 4.5]) {
    const scene = await model(`public/assets/models/char.courier-${variant}.skin.glb`); alignSkeleton(scene);
    const rig = resolveRig(scene), actor = new Group(); actor.add(scene);
    const animator = new KeyframeAnimator(rig, skinClips), state = pose(); state.variant = variant;
    let previous: Vector3[] | undefined, lastHip = 0, peakHipStep = 0, peakFootStep = 0;
    for (let tick = 1; tick <= 240; tick++) {
      actor.position.x += speed / 60; state.velocity.x = speed; animator.update(state, tick); actor.updateMatrixWorld(true);
      const feet = [rig.footL, rig.footR].map(n => n.getWorldPosition(new Vector3()));
      const hip = rig.hip.getWorldPosition(new Vector3()).y;
      if (tick > 90 && previous) {
        peakFootStep = Math.max(peakFootStep, ...feet.map((f, i) => f.distanceTo(previous![i])));
        peakHipStep = Math.max(peakHipStep, Math.abs(hip - lastHip));
        // Stance stays at anatomical hip width; the pilot swung into a wide lunge.
        expect(Math.abs(feet[0].z - feet[1].z)).toBeLessThan(.23);
      }
      previous = feet; lastHip = hip;
    }
    // The old sign-changing swing limiter jumped 24 cm in one 60 Hz frame.
    expect(peakFootStep, `${variant} ${speed} m/s`).toBeLessThan(.17);
    expect(peakHipStep, `${variant} ${speed} m/s`).toBeLessThan(.023);
  }
});

test.each(['female', 'male'] as const)('courier %s chains every melee beat on the sim contact tick and freezes exactly @E04', async variant => {
  const scene = await model(`public/assets/models/char.courier-${variant}.skin.glb`); alignSkeleton(scene);
  const rig = resolveRig(scene), animator = new KeyframeAnimator(rig, skinClips), state = pose(); state.variant = variant;
  let tick = 1;
  for (const actionId of ['weapon.fists', 'weapon.bat']) for (const [combo, move] of meleeMoves[actionId].entries()) {
    const start = tick, end = start + move.windup + move.active + move.recovery;
    state.animation = 'swing'; state.animationTick = start;
    state.attack = { actionId, combo, started: start, activeAt: start + move.windup, recoveryAt: start + move.windup + move.active, endsAt: end };
    for (; tick < end; tick++) {
      animator.update(state, tick);
      if (tick === state.attack.activeAt - 1) {
        const action = (animator as unknown as { actions: Map<string, AnimationAction> }).actions.get(animator.clip)!;
        expect(action.time / action.getClip().duration).toBeCloseTo(.2, 5);
        expect(action.getEffectiveWeight()).toBeCloseTo(1, 5);
        const frozen = Object.values(rig).map(n => [...n.position.toArray(), ...n.quaternion.toArray()]);
        animator.update(state, tick);
        expect(Object.values(rig).map(n => [...n.position.toArray(), ...n.quaternion.toArray()])).toEqual(frozen);
      }
    }
  }
  expect(animator.missingClips).toBe(0);
});
