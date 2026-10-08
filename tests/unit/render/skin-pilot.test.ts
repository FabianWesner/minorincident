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
import { retargetClip, skinClips } from '../../../src/render/characters/clips';
import type { SurvivorState } from '../../../src/data/survivor';
import type { Materials } from '../../../src/render/Materials';
import { meleeMoves } from '../../../src/data/meleeCombos';

async function model(path: string) {
  const file = readFileSync(path);
  return (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '')).scene;
}
function pose(): SurvivorState { return { variant: 'female', gearTier: 0, animation: 'idle', animationTick: 0, velocity: { x: 0, z: 0 }, grounded: true, invulnerableUntil: 0, checkpoint: { x: 0, y: .7, z: 0 }, diedAt: null }; }

test('courier skins default on and retain explicit A/B overrides', () => {
  expect(useSkinnedCourier(new URLSearchParams())).toBe(true);
  expect(useSkinnedCourier(new URLSearchParams('skin=1'))).toBe(true);
  expect(useSkinnedCourier(new URLSearchParams('skin=0'))).toBe(false);
});

test('courier facing ignores sub-degree arrival noise across the yaw wrap @E04', () => {
  const character = new CharacterView(); character.face(Math.PI - .001, 1);
  const rotation = character.quaternion.clone();
  for (let i = 1; i <= 120; i++) {
    character.face(i % 2 ? -Math.PI + .001 : Math.PI - .001, 1 + i / 60);
    expect(character.quaternion.angleTo(rotation)).toBeLessThan(1e-7);
  }
  character.face(Math.PI - .4, 4, true);
  expect(character.quaternion.angleTo(rotation)).toBeGreaterThan(.3);
});

/** Grounded heel/toe contacts from the foot node (sole offsets match CourierGroundContacts). */
type Contact = { heel: Vector3; toe: Vector3; yaw: number };
function contacts(rig: ReturnType<typeof resolveRig>, sole: number): Contact[] {
  return (['L', 'R'] as const).map(side => {
    const f = rig[`foot${side}`], fwd = new Vector3(1, 0, 0).transformDirection(f.matrixWorld);
    return { heel: f.localToWorld(new Vector3(-.05, -sole, 0)), toe: f.localToWorld(new Vector3(.085, -sole, 0)), yaw: Math.atan2(-fwd.z, fwd.x) };
  });
}
type Sample = { tick: number; speed: number; feet: Contact[]; pelvis: number; legs: Quaternion[]; knees: number[]; airborne: number };
/** Drive the fitted courier like the sim does: speed ramps, yaw turns at a bounded rate, travel follows the yaw. */
async function drive(variant: 'female' | 'male', ticks: number, plan: (t: number) => { speed: number; yaw: number; rate: number }) {
  const scene = await model(`public/assets/models/char.courier-${variant}.skin.glb`); alignSkeleton(scene);
  const rig = resolveRig(scene), actor = new CharacterView(); actor.add(scene); actor.updateMatrixWorld(true);
  const sole = rig.footL.getWorldPosition(new Vector3()).y;
  const animator = new KeyframeAnimator(rig, skinClips), state = pose(); state.variant = variant;
  const ground = (animator as unknown as { ground: { pivots: number; steps: number; contact(i: number): { locked: boolean } } }).ground;
  const samples: Sample[] = []; let speed = 0, yaw = 0;
  for (let tick = 1; tick <= ticks; tick++) {
    const want = plan(tick / 60);
    // The sim's click-to-move accelerates at 9 m/s² (run speed in ~0.5 s).
    speed += Math.sign(want.speed - speed) * Math.min(Math.abs(want.speed - speed), 9 / 60);
    const delta = Math.atan2(Math.sin(want.yaw - yaw), Math.cos(want.yaw - yaw));
    yaw += Math.sign(delta) * Math.min(Math.abs(delta), want.rate / 60);
    actor.face(yaw, tick / 60); actor.position.x += Math.cos(yaw) * speed / 60; actor.position.z -= Math.sin(yaw) * speed / 60;
    state.velocity = { x: Math.cos(yaw) * speed, z: -Math.sin(yaw) * speed };
    animator.update(state, tick); actor.updateMatrixWorld(true);
    const knees = (['L', 'R'] as const).map(side => { const hip = rig[`leg${side}`].getWorldPosition(new Vector3()), knee = rig[`shin${side}`].getWorldPosition(new Vector3()), ankle = rig[`foot${side}`].getWorldPosition(new Vector3()); return knee.clone().sub(hip).angleTo(ankle.sub(knee)) * 180 / Math.PI; });
    samples.push({ tick, speed, feet: contacts(rig, sole), pelvis: rig.hip.getWorldPosition(new Vector3()).y, legs: [rig.legL, rig.shinL, rig.legR, rig.shinR].map(n => n.quaternion.clone()), knees, airborne: [0, 1].filter(i => !ground.contact(i).locked).length });
  }
  return { samples, ground, actor };
}
/** Contact metrics as in tools/playeranim/metrics.ts: a foot is grounded while its lowest sole point is within 1.2 cm of the floor. */
function footwork(samples: Sample[], from = 0) {
  const frames = samples.filter(s => s.tick >= from), floor = Math.min(...samples.flatMap(s => s.feet.flatMap(c => [c.heel.y, c.toe.y])));
  const slides: number[] = [], drifts: number[] = [], lifts: number[] = [];
  for (let i = 0; i < 2; i++) {
    let slide = 0, drift = 0, startYaw: number | undefined, previous: Sample | undefined;
    for (const f of frames) {
      const c = f.feet[i], lowest = Math.min(c.heel.y, c.toe.y); lifts.push(lowest - floor);
      if (lowest < floor + .012) {
        if (startYaw === undefined) startYaw = c.yaw;
        else if (previous) {
          const pc = previous.feet[i], toe = c.toe.y < floor + .012 && pc.toe.y < floor + .012;
          const a = toe ? c.toe : c.heel, b = toe ? pc.toe : pc.heel;
          slide += Math.hypot(a.x - b.x, a.z - b.z);
          drift = Math.max(drift, Math.abs(Math.atan2(Math.sin(c.yaw - startYaw), Math.cos(c.yaw - startYaw))) * 180 / Math.PI);
        }
        previous = f;
      } else if (startYaw !== undefined) { slides.push(slide); drifts.push(drift); slide = 0; drift = 0; startYaw = undefined; previous = undefined; }
    }
    if (startYaw !== undefined) { slides.push(slide); drifts.push(drift); }
  }
  const pelvisStep = Math.max(0, ...frames.slice(1).map((f, i) => Math.abs(f.pelvis - frames[i].pelvis)));
  const legStep = Math.max(0, ...frames.slice(1).flatMap((f, i) => f.legs.map((q, j) => q.angleTo(frames[i].legs[j]) * 180 / Math.PI)));
  return { contacts: slides.length, slideMax: Math.max(0, ...slides), driftMax: Math.max(0, ...drifts), liftMax: Math.max(...lifts), pelvisStep, legStep };
}

test.each(['female', 'male'] as const)('courier %s walks and runs on world-locked feet with a readable knee arc @E04', async variant => {
  for (const speed of [2, 4.5]) {
    const { samples, ground } = await drive(variant, 300, t => ({ speed: t < .5 ? 0 : speed, yaw: 0, rate: 0 }));
    const steady = samples.filter(s => s.tick > 90), m = footwork(samples, 90);
    expect(m.contacts, `${variant} ${speed} m/s contacts`).toBeGreaterThan(12);
    expect(m.slideMax, `${variant} ${speed} m/s slide`).toBeLessThan(.025);
    expect(m.driftMax, `${variant} ${speed} m/s yaw drift`).toBeLessThan(1);
    expect(ground.pivots).toBe(0);
    // Swing feet clear the ground (the old fitted gait skimmed at 8 mm) and the knee flexes like a step, not a stilt.
    expect(m.liftMax).toBeGreaterThan(speed > 2.5 ? .08 : .04);
    const kneeMax = Math.max(...steady.flatMap(s => s.knees));
    expect(kneeMax).toBeGreaterThan(speed > 2.5 ? 70 : 55); expect(kneeMax).toBeLessThan(speed > 2.5 ? 95 : 80);
    // No vaulting: moderate pelvis bob, continuous joints.
    expect(m.pelvisStep, `${variant} ${speed} m/s pelvis step`).toBeLessThan(.025);
    expect(m.legStep, `${variant} ${speed} m/s leg step`).toBeLessThan(speed > 2.5 ? 40 : 32);
    // Walking keeps one foot on the ground; running flies briefly.
    if (speed < 2.5) expect(steady.filter(s => s.airborne === 2).length).toBe(0);
    else expect(steady.filter(s => s.airborne === 2).length).toBeGreaterThan(0);
  }
});

test.each(['female', 'male'] as const)('courier %s turns with steps instead of pivoting or skating @E04', async variant => {
  // Click-to-move turns: 180° from standing and while walking, 90° while walking, all at the sim's 4.5 rad/s;
  // a keyboard 180° while running follows the presentation cap of 6 rad/s.
  const cases: { name: string; ticks: number; plan: (t: number) => { speed: number; yaw: number; rate: number }; minSteps: number }[] = [
    { name: 'pivot180', ticks: 240, plan: t => ({ speed: 0, yaw: t >= 1 ? Math.PI : 0, rate: 4.5 }), minSteps: 3 },
    { name: 'walk-turn180', ticks: 300, plan: t => ({ speed: t < .5 ? 0 : 2, yaw: t >= 2 ? Math.PI : 0, rate: 4.5 }), minSteps: 0 },
    { name: 'walk-turn90', ticks: 300, plan: t => ({ speed: t < .5 ? 0 : 2, yaw: t >= 2 ? Math.PI / 2 : 0, rate: 4.5 }), minSteps: 0 },
    { name: 'run-turn180', ticks: 300, plan: t => ({ speed: t < .5 ? 0 : t >= 2.5 && t < 2.9 ? 1.5 : 4.5, yaw: t >= 2.5 ? Math.PI : 0, rate: 6 }), minSteps: 0 },
  ];
  for (const c of cases) {
    const { samples, ground } = await drive(variant, c.ticks, c.plan);
    const m = footwork(samples, 30);
    // Running touchdowns keep part of the body speed (short legs cannot reach a fully matched heel strike), so the
    // contact frame of a 6 rad/s running turn may carry up to ~4 cm; walking and standing turns stay under 2 cm.
    expect(m.slideMax, `${variant} ${c.name} slide`).toBeLessThan(c.name.startsWith('run') ? .045 : .02);
    expect(m.driftMax, `${variant} ${c.name} planted yaw drift`).toBeLessThan(6);
    expect(ground.pivots, `${variant} ${c.name} pivots`).toBe(0);
    expect(ground.steps, `${variant} ${c.name} steps`).toBeGreaterThanOrEqual(c.minSteps);
    expect(m.legStep, `${variant} ${c.name} leg step`).toBeLessThan(c.name.startsWith('run') ? 40 : 35);
    if (c.name === 'pivot180') {
      // Standing: never both feet in the air; the turn settles with both feet locked under the body, facing the new heading.
      expect(samples.filter(s => s.airborne === 2).length).toBe(0);
      const settled = samples.filter(s => s.tick > 150);
      expect(settled.every(s => s.airborne === 0)).toBe(true);
      for (const c2 of settled[0].feet) expect(Math.abs(Math.atan2(Math.sin(c2.yaw - Math.PI), Math.cos(c2.yaw - Math.PI)))).toBeLessThan(.2);
      expect(settled[0].feet[0].heel.distanceTo(settled[0].feet[1].heel)).toBeLessThan(.3);
    }
  }
});

test.each(['female', 'male'] as const)('courier %s stops onto locked feet without a sliding settle @E04', async variant => {
  const { samples, ground } = await drive(variant, 240, t => ({ speed: t < .5 ? 0 : t < 2 ? 4.5 : 0, yaw: 0, rate: 0 }));
  const m = footwork(samples, 110);
  expect(m.slideMax, `${variant} stop slide`).toBeLessThan(.02);
  expect(ground.pivots).toBe(0);
  // The body comes to rest around tick 150 (9 m/s² decel); 0.6 s later both feet are planted, side by side, and stay put.
  const settled = samples.filter(s => s.tick > 186);
  expect(settled.every(s => s.airborne === 0)).toBe(true);
  for (const s of settled) for (let i = 0; i < 2; i++) expect(s.feet[i].heel.distanceTo(settled[0].feet[i].heel)).toBeLessThan(.001);
  expect(Math.abs(settled[0].feet[0].heel.z - settled[0].feet[1].heel.z)).toBeLessThan(.3);
  expect(Math.abs(settled[0].feet[0].heel.x - settled[0].feet[1].heel.x)).toBeLessThan(.2);
});

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

test.each(['female', 'male'] as const)('courier %s chains every melee beat on the sim contact tick and freezes exactly @E04', async variant => {
  const scene = await model(`public/assets/models/char.courier-${variant}.skin.glb`); alignSkeleton(scene);
  const rig = resolveRig(scene), animator = new KeyframeAnimator(rig, skinClips), state = pose(); state.variant = variant;
  let tick = 1;
  const legs = [rig.legL, rig.shinL, rig.legR, rig.shinR];
  let previous: Quaternion[] | undefined;
  for (const actionId of ['weapon.fists', 'weapon.bat']) for (const [combo, move] of meleeMoves[actionId].entries()) {
    const start = tick, end = start + move.windup + move.active + move.recovery;
    state.animation = 'swing'; state.animationTick = start;
    state.attack = { actionId, combo, started: start, activeAt: start + move.windup, recoveryAt: start + move.windup + move.active, endsAt: end };
    for (; tick < end; tick++) {
      animator.update(state, tick);
      if (previous) for (const [i, leg] of legs.entries()) {
        // Feet stay world-locked through planted strikes, so the authored pelvis snap at contact lands in the leg joints (bat-3: ~58°).
        expect(leg.quaternion.angleTo(previous[i]) * 180 / Math.PI, `${variant} ${actionId} ${combo} tick ${tick}`).toBeLessThan(60);
      }
      previous = legs.map(leg => leg.quaternion.clone());
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

test.each(['female', 'male'] as const)('courier %s mount and dismount preserve the last presented position across the sim seat/exit snap @E04', async variant => {
  const loader = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(async path => ({ scene: await model(`public${path}`) }) as never);
  const material = () => Object.assign(new MeshLambertMaterial({ vertexColors: true }), { bloodCoverage: { value: 0 } });
  const materials = { fromVertexColors: material, fromColor: material, get: material, unique: material } as unknown as Materials;
  const character = new CharacterView(), state = pose(); state.variant = variant;
  try {
    await character.init(materials, false, false, 'courier', true);
    const bike = await model('public/assets/models/veh.courier-bike.glb'); bike.scale.setScalar(.6); bike.rotation.y = 1.4; bike.updateMatrixWorld(true);
    const contacts = new RiderContacts(); bike.getWorldQuaternion(contacts.orientation);
    for (const [name, node] of [['seat', 'seat'], ['handL', 'grip_l'], ['handR', 'grip_r'], ['footL', 'pedal_l'], ['footR', 'pedal_r']] as const) bike.getObjectByName(node)!.getWorldPosition(contacts[name]);
    character.position.set(.85, 0, .2); character.face(0, 1 / 60); character.update(state, 1, 1); character.applyRideContacts();
    const standing = character.position.clone(), standingRotation = character.quaternion.clone();
    for (let tick = 2; tick <= 40; tick++) {
      character.position.set(0, 0, 0); character.face(1.4, tick / 60, false, contacts.orientation);
      character.update(state, tick, 1, { pedal: 0, steer: 0 }); character.applyRideContacts(contacts);
      if (tick === 2) {
        expect(character.position.distanceTo(standing)).toBeLessThan(1e-6);
        expect(character.quaternion.angleTo(standingRotation)).toBeLessThan(1e-6);
      }
      // Frozen evaluations retain the same partial mount, including orientation.
      const p = character.position.clone(), q = character.quaternion.clone();
      character.position.set(0, 0, 0); character.face(1.4, tick / 60, false, contacts.orientation);
      character.update(state, tick, 1, { pedal: 0, steer: 0 }); character.applyRideContacts(contacts);
      expect(character.position.distanceTo(p)).toBeLessThan(1e-6); expect(character.quaternion.angleTo(q)).toBeLessThan(1e-6);
    }
    const seated = character.position.clone();
    character.position.set(.85, 0, .2); character.update(state, 41, 1); character.applyRideContacts();
    expect(character.position.distanceTo(seated)).toBeLessThan(1e-6);
    for (let tick = 42; tick <= 75; tick++) { character.position.set(.85, 0, .2); character.update(state, tick, 1); character.applyRideContacts(); }
    expect(character.position.distanceTo(standing)).toBeLessThan(1e-6); expect(character.getState().rideWeight).toBe(0);
  } finally { character.dispose(); loader.mockRestore(); }
});

test('courier authored anticipation repair preserves the exact contact pose @E04', async () => {
  const scene = await model('public/assets/models/char.courier-female.skin.glb'); alignSkeleton(scene);
  for (const name of ['unarmed-front-kick', 'unarmed-roundhouse-kick', 'unarmed-knee', 'unarmed-spinning-backfist']) {
    const before = retargetClip(scene, name), after = retargetClip(scene, name, false, skinClips);
    for (const track of after.tracks.filter(t => t.name.endsWith('.quaternion'))) {
      // Skeleton v2 chain joints (spine, chest, neck, clavicles) are not authored: they hold the rest pose.
      const source = before.tracks.find(t => t.name === track.name);
      const a = source ? new Quaternion().fromArray(source.InterpolantFactoryMethodLinear().evaluate(before.duration * .2)) : scene.getObjectByName(track.name.split('.')[0])!.quaternion.clone();
      const b = new Quaternion().fromArray(track.InterpolantFactoryMethodLinear().evaluate(after.duration * .2));
      expect(a.normalize().angleTo(b.normalize()), `${name} ${track.name}`).toBeLessThan(1e-5);
    }
  }
});

test.each(['female', 'male'] as const)('courier %s chest and head stay over the hips through idle, gait, start, stop and 90/180 turns @E04', async variant => {
  for (const scenario of ['idle', 'walk', 'run', 'start-stop', 'turn90', 'turn180']) {
    const scene = await model(`public/assets/models/char.courier-${variant}.skin.glb`); alignSkeleton(scene);
    const rig = resolveRig(scene), actor = new CharacterView(); actor.add(scene);
    const animator = new KeyframeAnimator(rig, skinClips), state = pose(); state.variant = variant;
    let speed = 0;
    for (let tick = 1; tick <= 360; tick++) {
      const target = tick < 30 || scenario === 'idle' || scenario === 'start-stop' && tick > 180 ? 0 : scenario === 'run' || scenario === 'start-stop' && tick > 100 ? 4.5 : 2;
      speed += Math.sign(target - speed) * Math.min(Math.abs(target - speed), (target > speed ? 36 : 54) / 60);
      const yaw = tick > 150 && scenario.startsWith('turn') ? scenario === 'turn90' ? Math.PI / 2 : Math.PI : 0;
      actor.face(yaw, tick / 60); actor.position.x += Math.cos(yaw) * speed / 60; actor.position.z -= Math.sin(yaw) * speed / 60;
      state.velocity = { x: Math.cos(yaw) * speed, z: -Math.sin(yaw) * speed };
      animator.update(state, tick); actor.updateMatrixWorld(true);
      const hip = rig.hip.getWorldPosition(new Vector3()), forward = new Vector3(1, 0, 0).applyQuaternion(actor.quaternion);
      const chest = rig.armL.getWorldPosition(new Vector3()).add(rig.armR.getWorldPosition(new Vector3())).multiplyScalar(.5);
      for (const [joint, point] of [['chest', chest], ['head', rig.head.getWorldPosition(new Vector3())]] as const) {
        const d = point.sub(hip), pitch = Math.atan2(d.dot(forward), d.y) * 180 / Math.PI;
        expect(pitch, `${scenario} ${joint} tick ${tick}`).toBeGreaterThanOrEqual(0);
        if (scenario === 'run' && tick > 90) { expect(pitch).toBeGreaterThanOrEqual(8); expect(pitch).toBeLessThanOrEqual(12); }
      }
      if (tick > 90 && ['idle', 'walk', 'run'].includes(scenario)) for (const side of ['L', 'R'] as const) {
        // The chest (skeleton v2 spine_03; the torso joint on older rigs) is what reads as body twist.
        const chestNode = scene.getObjectByName('chest') ?? rig.torso;
        const facing = new Vector3(1, 0, 0).applyQuaternion(actor.quaternion.clone().invert().multiply(chestNode.getWorldQuaternion(new Quaternion())));
        expect(Math.abs(Math.atan2(-facing.z, facing.x)) * 180 / Math.PI).toBeLessThan(13);
        const upper = rig[`foreArm${side}`].getWorldPosition(new Vector3()).sub(rig[`arm${side}`].getWorldPosition(new Vector3()));
        const lower = rig[`hand${side}`].getWorldPosition(new Vector3()).sub(rig[`foreArm${side}`].getWorldPosition(new Vector3()));
        const elbow = upper.angleTo(lower) * 180 / Math.PI;
        expect(elbow).toBeGreaterThan(10); expect(elbow).toBeLessThan(100);
      }
    }
  }
});
