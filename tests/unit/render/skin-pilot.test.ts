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

async function model(path: string) {
  const file = readFileSync(path);
  return (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '')).scene;
}
function pose(): SurvivorState { return { variant: 'female', gearTier: 0, animation: 'idle', animationTick: 0, velocity: { x: 0, z: 0 }, grounded: true, invulnerableUntil: 0, checkpoint: { x: 0, y: .7, z: 0 }, diedAt: null }; }

test('skin pilot remains opt-in with explicit A/B overrides', () => {
  expect(useSkinnedCourier(new URLSearchParams())).toBe(false);
  expect(useSkinnedCourier(new URLSearchParams('skin=1'))).toBe(true);
  expect(useSkinnedCourier(new URLSearchParams('skin=0'))).toBe(false);
});

test.each([2, 4.5])('skin pilot plants stance feet at actual %s m/s with capped cadence @E04', async speed => {
  const scene = await model('public/assets/models/char.courier-female.skin.glb');
  expect(alignSkeleton(scene)).toHaveLength(1);
  const rig = resolveRig(scene), actor = new Group(); actor.add(scene);
  const animator = new KeyframeAnimator(rig, skinClips), state = pose();
  let samples = 0, maxSlide = 0, maxCadence = 0, previousPhase = -1, previous: Vector3 | undefined;
  for (let tick = 1; tick <= 240; tick++) {
    actor.position.x += speed / 60; state.velocity.x = speed; animator.update(state, tick); actor.updateMatrixWorld(true);
    const gait = (animator as unknown as { actions: Map<string, AnimationAction> }).actions.get(speed > 2.5 ? 'run' : 'walk')!;
    const phase = gait.time / gait.getClip().duration, foot = rig.footL.getWorldPosition(new Vector3());
    const stance = speed > 2.5 ? .24 : .55 - .31 * ((2 - 1.9) / (3.3 - 1.9)) ** 2 * (3 - 2 * (2 - 1.9) / (3.3 - 1.9));
    if (tick > 90 && previous && phase > previousPhase && phase < stance && previousPhase < stance) { samples++; maxSlide = Math.max(maxSlide, foot.distanceTo(previous)); }
    if (tick > 90) maxCadence = Math.max(maxCadence, ((phase - previousPhase + 1) % 1) * 60);
    previousPhase = phase; previous = foot;
  }
  expect(samples).toBeGreaterThan(15); expect(maxSlide).toBeLessThan(.001); expect(maxCadence).toBeLessThan(speed > 2.5 ? 2.701 : 2.011);
  const meshes: SkinnedMesh[] = []; scene.traverse(node => { if (node instanceof SkinnedMesh) meshes.push(node); });
  expect(meshes).toHaveLength(1);
  const before = rig.footL.getWorldPosition(new Vector3()); animator.update(state, 240); actor.updateMatrixWorld(true);
  expect(rig.footL.getWorldPosition(new Vector3()).distanceTo(before)).toBeLessThan(1e-6);
});

test('skin pilot hands and soles follow bike sockets under heading, lean, steering and crank rotation @E04', async () => {
  const loader = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(async path => ({ scene: await model(`public${path}`) }) as never);
  const material = () => Object.assign(new MeshLambertMaterial({ vertexColors: true }), { bloodCoverage: { value: 0 } });
  const materials = { fromVertexColors: material, fromColor: material, get: material, unique: material } as unknown as Materials;
  const character = new CharacterView();
  try {
    await character.init(materials, false, false, 'courier', true);
    const bike = await model('public/assets/models/veh.courier-bike.glb'); bike.scale.setScalar(.6); bike.rotation.set(.14, 1.2, 0);
    const targets = new RiderContacts(), state = pose(), axis = new Vector3(0, 0, 1);
    let skin!: SkinnedMesh; character.traverse(node => { if (node instanceof SkinnedMesh) skin = node; });
    const handRotation = new Quaternion().setFromAxisAngle(axis, Math.PI / 2);
    for (let tick = 1; tick <= 90; tick++) {
      const pedal = tick * .075; bike.getObjectByName('crank')!.rotation.z = -pedal; bike.getObjectByName('handlebar')!.rotation.y = Math.sin(tick / 15) * .4;
      bike.updateMatrixWorld(true); bike.getWorldQuaternion(targets.orientation);
      for (const [name, node] of [['seat', 'seat'], ['handL', 'grip_l'], ['handR', 'grip_r'], ['footL', 'pedal_l'], ['footR', 'pedal_r']] as const) bike.getObjectByName(node)!.getWorldPosition(targets[name]);
      character.position.set(0, 0, 0); character.quaternion.identity(); character.update(state, tick, 1, { pedal, steer: 0 }); character.applyRideContacts(targets);
      if (tick < 30) continue;
      expect(character.getState().clip).toBe('ride'); expect(character.getState().missingClips).toBe(0);
      for (const side of ['L', 'R'] as const) {
        const hand = character.getObjectByName(`hand${side}`)!, socket = character.getObjectByName(`weaponSocket${side}`)!;
        expect(socket.getWorldPosition(new Vector3()).distanceTo(targets[`hand${side}`]), `${side} tick ${tick}`).toBeLessThan(.006);
        expect(hand.getWorldQuaternion(new Quaternion()).angleTo(targets.orientation.clone().multiply(handRotation))).toBeLessThan(.001);
        const foot = character.getObjectByName(`foot${side}`)!, sole = foot.getWorldPosition(new Vector3()).add(new Vector3(0, -.1775, 0).applyQuaternion(targets.orientation));
        expect(sole.distanceTo(targets[`foot${side}`])).toBeLessThan(.006);
      }
      skin.skeleton.update();
    }
    const frozen = character.getObjectByName('handL')!.getWorldPosition(new Vector3());
    character.position.set(0, 0, 0); character.quaternion.identity(); character.update(state, 90, 1, { pedal: 90 * .075, steer: 0 }); character.applyRideContacts(targets); character.updateMatrixWorld(true);
    expect(character.getObjectByName('handL')!.getWorldPosition(new Vector3()).distanceTo(frozen)).toBeLessThan(1e-6);
    character.update(state, 91, 1); character.applyRideContacts(); expect(character.getState().clip).toBe('dismount');
    for (let tick = 92; tick <= 120; tick++) { character.position.set(0, 0, 0); character.update(state, tick, 1); character.applyRideContacts(); }
    expect(character.getState().rideWeight).toBe(0); expect(character.getState().clip).toBe('idle');
  } finally { character.dispose(); loader.mockRestore(); }
});
