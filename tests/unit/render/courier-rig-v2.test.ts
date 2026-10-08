import { readFileSync } from 'node:fs';
import { MeshLambertMaterial, Quaternion, Vector3, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { afterEach, expect, test, vi } from 'vitest';
import { CharacterView } from '../../../src/render/characters/CharacterView';
import type { CourierLiving } from '../../../src/render/characters/CourierRig';
import { skinClips } from '../../../src/render/characters/clips';
import type { SurvivorState } from '../../../src/data/survivor';
import type { Materials } from '../../../src/render/Materials';

async function model(path: string) {
  const file = readFileSync(path);
  return (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '')).scene;
}
function pose(variant: 'female' | 'male'): SurvivorState { return { variant, gearTier: 0, animation: 'idle', animationTick: 0, velocity: { x: 0, z: 0 }, grounded: true, invulnerableUntil: 0, checkpoint: { x: 0, y: .7, z: 0 }, diedAt: null }; }
const DEG = Math.PI / 180;
afterEach(() => vi.restoreAllMocks());
async function courier(variant: 'female' | 'male') {
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(async path => ({ scene: await model(`public${path}`) }) as never);
  const material = () => Object.assign(new MeshLambertMaterial({ vertexColors: true }), { bloodCoverage: { value: 0 } });
  const materials = { fromVertexColors: material, fromColor: material, get: material, unique: material } as unknown as Materials;
  const character = new CharacterView(); await character.init(materials, false, false, 'courier', true);
  const loaded = (character as unknown as { characters: Map<string, { model: Object3D; living?: CourierLiving }> }).characters.get(variant)!;
  const state = pose(variant);
  let speed = 0, yaw = 0;
  /** One presented frame like GameView: facing, sim pose, glance target, ride contacts (the living layer runs last). */
  const frame = (tick: number, want: { speed?: number; yaw?: number; look?: Vector3 | null } = {}) => {
    const target = want.speed ?? 0; speed += Math.sign(target - speed) * Math.min(Math.abs(target - speed), 9 / 60);
    const delta = Math.atan2(Math.sin((want.yaw ?? yaw) - yaw), Math.cos((want.yaw ?? yaw) - yaw)); yaw += Math.sign(delta) * Math.min(Math.abs(delta), 4.5 / 60);
    character.position.x += Math.cos(yaw) * speed / 60; character.position.z -= Math.sin(yaw) * speed / 60;
    state.velocity = { x: Math.cos(yaw) * speed, z: -Math.sin(yaw) * speed };
    character.face(yaw, tick / 60); character.update(state, tick, 1); character.glanceAt(want.look ?? null); character.applyRideContacts(); character.updateMatrixWorld(true);
  };
  const snapshot = () => { const out: number[] = []; loaded.model.traverse(n => out.push(...n.position.toArray(), ...n.quaternion.toArray(), ...n.scale.toArray())); return out; };
  return { character, living: loaded.living!, root: loaded.model, state, frame, snapshot, get speed() { return speed; } };
}

test.each(['female', 'male'] as const)('courier %s skeleton v2 carries the Mesh2Motion chain and the clips retarget onto it', async variant => {
  const c = await courier(variant);
  for (const name of ['spine', 'chest', 'neck', 'clavicleL', 'clavicleR', 'foreArmTwistL', 'elbowR', 'kneeL', 'toeR', 'eyeL', 'irisR']) expect(c.root.getObjectByName(name), name).toBeTruthy();
  expect(c.root.getObjectByName('head')!.parent!.name).toBe('neck');
  expect(c.root.getObjectByName('armL')!.parent!.name).toBe('clavicleL');
  expect(!!c.root.getObjectByName('pony3')).toBe(variant === 'female');
  for (const clip of skinClips.values()) for (const node of ['spine', 'chest', 'neck', 'clavicleL', 'clavicleR']) expect(clip.tracks.some(t => t.node === node), `${clip.name} ${node}`).toBe(true);
  c.character.dispose();
});

test.each(['female', 'male'] as const)('courier %s living layer is frozen-frame exact and deterministic across runs @E04', async variant => {
  const run = async () => {
    const c = await courier(variant), threat = new Vector3(2, 1.1, -2), states: number[][] = [];
    for (let tick = 1; tick <= 240; tick++) {
      c.frame(tick, { speed: tick < 120 ? 4.5 : 0, look: tick > 60 ? threat : null });
      if (tick % 40 === 0) {
        const before = c.snapshot();
        // Same tick again (pause, hit-stop): the pose is bit-identical, nothing accumulates.
        c.character.update(c.state, tick, 1); c.character.glanceAt(threat); c.character.applyRideContacts(); c.character.updateMatrixWorld(true);
        expect(c.snapshot()).toEqual(before);
        states.push(before);
      }
    }
    c.character.dispose(); return states;
  };
  expect(await run()).toEqual(await run());
});

test.each(['female', 'male'] as const)('courier %s glances at a threat within ±70°, at most 360°/s, never while striking @E04', async variant => {
  const c = await courier(variant);
  const chest = c.root.getObjectByName('chest')!, head = c.root.getObjectByName('head')!;
  let previous = 0, maxRate = 0;
  for (let tick = 1; tick <= 120; tick++) {
    // Threat straight to the courier's left (90°): the turn clamps at 70°.
    c.frame(tick, { look: tick > 10 ? new Vector3(0, 1.1, -3) : null });
    const yaw = c.living.stats.yaw; maxRate = Math.max(maxRate, Math.abs(yaw - previous) * 60); previous = yaw;
  }
  expect(c.living.stats.yaw).toBeGreaterThan(55 * DEG); expect(c.living.stats.yaw).toBeLessThanOrEqual(70 * DEG + 1e-6);
  expect(maxRate).toBeLessThanOrEqual(360 * DEG + 1e-6);
  const facing = (node: Object3D) => { const f = new Vector3(1, 0, 0).applyQuaternion(node.getWorldQuaternion(new Quaternion())); return Math.atan2(-f.z, f.x); };
  expect(Math.abs(facing(head) - facing(chest))).toBeLessThan(70 * DEG);
  expect(facing(head)).toBeGreaterThan(45 * DEG); // the face really turned toward the threat
  // A strike fades the glance out before contact.
  c.state.animation = 'swing'; c.state.animationTick = 121;
  c.state.attack = { actionId: 'weapon.bat', combo: 0, started: 121, activeAt: 129, recoveryAt: 133, endsAt: 150 };
  for (let tick = 121; tick <= 128; tick++) c.frame(tick, { look: new Vector3(0, 1.1, -3) });
  expect(c.living.stats.weight).toBeLessThan(.05);
  c.character.dispose();
});

test.each(['female', 'male'] as const)('courier %s ponytail and bag settle after a run-to-stop and stay outside their colliders @E04', async variant => {
  const c = await courier(variant), head = c.root.getObjectByName('head')!, chest = c.root.getObjectByName('chest')!;
  const pony = c.root.getObjectByName('pony3'), bag = c.root.getObjectByName('backpackSocket')!;
  const tips: { tick: number; pony: Vector3 | null; bag: Vector3; speed: number }[] = [];
  let swing = 0;
  for (let tick = 1; tick <= 300; tick++) {
    c.frame(tick, { speed: tick < 150 ? 4.5 : 0 });
    swing = Math.max(swing, Math.abs(c.living.stats.bagPitch));
    // Secondary motion relative to what carries it (head for the ponytail, chest for the bag), not the body's own steps.
    tips.push({ tick, pony: pony ? head.worldToLocal(c.living.stats.tip.clone()) : null, bag: chest.worldToLocal(bag.localToWorld(new Vector3(-.07, -.2, -.1))), speed: c.speed });
    if (pony) {
      // Colliders: skull sphere and upper back sphere (radius - 2 mm tolerance).
      expect(c.living.stats.tip.distanceTo(head.localToWorld(new Vector3(-.03, .17, 0)))).toBeGreaterThan(.2 - .002);
      expect(c.living.stats.tip.distanceTo(chest.localToWorld(new Vector3(-.04, .02, 0)))).toBeGreaterThan(.13 - .002);
    }
  }
  expect(swing).toBeGreaterThan(2 * DEG); // the bag really swings
  const stopped = tips.find(t => t.tick > 150 && t.speed === 0)!.tick;
  for (const key of ['pony', 'bag'] as const) {
    if (!tips[0][key]) continue;
    // The courier still takes its settle step ~0.4 s after the stop (re-exciting the bag); 1 s after the stop all is still.
    const settle = tips.filter(t => t.tick > stopped + 60);
    for (let i = 1; i < settle.length; i++) expect(settle[i][key]!.distanceTo(settle[i - 1][key]!) * 60, `${key} tick ${settle[i].tick}`).toBeLessThan(.02);
  }
  c.character.dispose();
});

test('courier blinks every 2–6 s with the lids closed for about 0.1 s @E04', async () => {
  const c = await courier('female'), eye = c.root.getObjectByName('eyeL')!;
  const closures: [number, number][] = []; let start = -1;
  for (let tick = 1; tick <= 3600; tick++) {
    c.frame(tick);
    const closed = eye.scale.y < .5;
    if (closed && start < 0) start = tick; else if (!closed && start >= 0) { closures.push([start, tick]); start = -1; }
  }
  expect(closures.length).toBeGreaterThanOrEqual(10); expect(closures.length).toBeLessThanOrEqual(30);
  const intervals = closures.slice(1).map((b, i) => (b[0] - closures[i][0]) / 60), mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  expect(mean).toBeGreaterThan(2); expect(mean).toBeLessThan(6);
  for (const [a, b] of closures) { expect((b - a) / 60).toBeGreaterThanOrEqual(.03); expect((b - a) / 60).toBeLessThanOrEqual(.15); }
  c.character.dispose();
});

test.each(['female', 'male'] as const)('courier %s bat swings keep the hand within 90° of its twist bone (no wrist candy-wrap) @E04', async variant => {
  const c = await courier(variant);
  let worst = 0;
  for (const [combo, tick0] of [[0, 1], [1, 40], [2, 80]] as const) {
    c.state.animation = 'swing'; c.state.animationTick = tick0;
    c.state.attack = { actionId: 'weapon.bat', combo, started: tick0, activeAt: tick0 + 8, recoveryAt: tick0 + 12, endsAt: tick0 + 36 };
    for (let tick = tick0; tick < tick0 + 36; tick++) {
      c.frame(tick);
      for (const side of ['L', 'R']) {
        const hand = c.root.getObjectByName(`hand${side}`)!, twist = c.root.getObjectByName(`foreArmTwist${side}`)!;
        // Roll of the hand relative to the twist bone, about the forearm axis.
        const relative = twist.quaternion.clone().invert().multiply(hand.quaternion), axis = hand.position.clone().normalize();
        const d = relative.x * axis.x + relative.y * axis.y + relative.z * axis.z;
        worst = Math.max(worst, 2 * Math.atan2(Math.abs(d), Math.abs(relative.w)));
      }
    }
  }
  expect(worst).toBeLessThan(90 * DEG);
  c.character.dispose();
});
