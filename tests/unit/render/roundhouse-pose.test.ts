import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { expect, test } from 'vitest';
import { alignSkeleton } from '../../../src/render/characters/skin';
import { resolveRig } from '../../../src/render/characters/rig';
import { KeyframeAnimator } from '../../../src/render/characters/KeyframeAnimator';
import { CharacterView } from '../../../src/render/characters/CharacterView';
import { skinClips } from '../../../src/render/characters/clips';
import { roundhouseSpin } from '../../../src/render/GameView';
import type { SurvivorState } from '../../../src/data/survivor';

/** Bat roundhouse presentation (00 §6.2): the body turns a full circle; the lead foot pivots in place (turns, never
 * slides) while the other foot circles off the ground, and both are planted again after the follow-through. */
test('@E04 @E05 roundhouse: full-circle body spin, lead foot pivots on the spot, trail foot lifts and lands', async () => {
  const file = readFileSync('public/assets/models/char.courier-female.skin.glb');
  const scene = (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '')).scene;
  alignSkeleton(scene);
  const rig = resolveRig(scene), actor = new CharacterView(); actor.add(scene); actor.updateMatrixWorld(true);
  const animator = new KeyframeAnimator(rig, skinClips);
  const ground = (animator as unknown as { ground: { contact(i: number): { target: Vector3; yaw: number; locked: boolean } } }).ground;
  const state: SurvivorState = { variant: 'female', gearTier: 0, animation: 'idle', animationTick: 0, velocity: { x: 0, z: 0 }, grounded: true, invulnerableUntil: 0, checkpoint: { x: 0, y: .7, z: 0 }, diedAt: null };
  const attack = { actionId: 'weapon.bat', combo: 0, started: 60, activeAt: 67, recoveryAt: 79, endsAt: 96, style: 'roundhouse' as const };
  let leadFrom: Vector3 | undefined, leadYaw = 0, turned = 0, maxSlide = 0, trailAir = 0, minSpin = 0, maxSpin = 0;
  for (let tick = 1; tick <= 150; tick++) {
    const striking = tick >= attack.started && tick < attack.endsAt;
    if (tick === attack.started) { state.animation = 'swing'; state.animationTick = tick; state.attack = attack; }
    if (tick === attack.endsAt) { state.animation = 'idle'; delete state.attack; }
    const spin = striking ? roundhouseSpin(attack, tick) : 0;
    minSpin = Math.min(minSpin, spin); maxSpin = Math.max(maxSpin, spin);
    actor.face(0, tick / 60, striking, undefined, spin); actor.updateMatrixWorld(true);
    animator.update(state, tick); actor.updateMatrixWorld(true);
    const lead = ground.contact(0), trail = ground.contact(1);
    if (tick >= attack.activeAt && tick < attack.recoveryAt) {
      expect(lead.locked, `tick ${tick}`).toBe(true);
      leadFrom ??= lead.target.clone();
      maxSlide = Math.max(maxSlide, Math.hypot(lead.target.x - leadFrom.x, lead.target.z - leadFrom.z));
      turned += Math.abs(Math.atan2(Math.sin(lead.yaw - leadYaw), Math.cos(lead.yaw - leadYaw)));
      if (!trail.locked) trailAir++;
    }
    leadYaw = lead.yaw;
  }
  // The body coils against the swing, then turns the full circle.
  expect(minSpin).toBeLessThan(-.3); expect(maxSpin).toBeGreaterThan(Math.PI * 2 * .9);
  // Lead foot: pivots (turns most of the circle) without sliding; heel/toe roll aside, the ankle stays put within 2 cm.
  expect(turned).toBeGreaterThan(Math.PI * 1.5);
  expect(maxSlide).toBeLessThan(.02);
  // Trail foot circles off the ground through the spin; both feet are planted again afterwards.
  expect(trailAir).toBeGreaterThanOrEqual(attack.recoveryAt - attack.activeAt - 1);
  expect(ground.contact(0).locked && ground.contact(1).locked).toBe(true);
});
