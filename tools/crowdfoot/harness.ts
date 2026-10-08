import { readFileSync } from 'node:fs';
import { Matrix4, Quaternion, Vector3, type Group } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { bakeInfected, civilianClips, framesPerClip } from '../../src/render/characters/bakeInfected';
import { CrowdFootwork, CrowdLocomotion, type CrowdLayers } from '../../src/render/characters/CrowdLocomotion';
import { CrowdPosePalette } from '../../src/render/characters/CrowdPosePalette';
import { GaitPhase } from '../../src/render/characters/GaitPhase';
import { InfectedMoves } from '../../src/render/characters/InfectedMoves';
import { MotionPresentation, crowdTurnRate } from '../../src/render/characters/MotionPresentation';
import type { GaitStyle } from '../../src/render/characters/CourierGroundContacts';
import type { EntitySnapshot } from '../../src/sim/world/types';

/** Crowd footwork harness (pedestrians and infected): the shipped bake, pose atlas and CrowdLocomotion, driven like
 * the crowd views drive them (distance-driven gait phase, presentation turn cap), measured model-free from the
 * displayed foot parts: a foot is grounded while its lowest sole point is within 1.2 cm of the floor. */
export async function load(asset: string): Promise<Group> {
  const bytes = readFileSync(`public/assets/models/${asset}.glb`);
  return (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
}
type Feet = { heel: Vector3; toe: Vector3; yaw: number }[];
interface Plan { speed: number; yaw: number; rate?: number; attack?: { until: number }; hit?: { started: number; until: number; heavy?: boolean } }
interface Figure { kind: 'civilian' | 'infected'; tier?: 'infected-frail' | 'infected-lurch' | 'infected-sprint' }
export async function drive(asset: string, figure: Figure, seconds: number, plan: (t: number) => Plan, near = true, scale = 1) {
  const scene = await load(asset);
  const baked = bakeInfected(scene, [], false, civilianClips), palette = new CrowdPosePalette(baked.clip, 2);
  const footwork = new CrowdFootwork(), loco = new CrowdLocomotion(scene, baked.clip, footwork), gait = new GaitPhase(), moves = new InfectedMoves();
  const presentation = new MotionPresentation(crowdTurnRate);
  const feetParts = ['footL', 'footR'].map(n => baked.clip.parts.indexOf(n));
  const hip = scene.getObjectByName('hip')!; scene.updateMatrixWorld(true);
  const s = hip.parent!.getWorldScale(new Vector3()).y * scale, sole = scene.getObjectByName('footL')!.getWorldPosition(new Vector3()).y * scale;
  const transform = new Matrix4(), part = new Matrix4(), p = new Vector3(), q = new Quaternion(), sc = new Vector3();
  const frames: { t: number; speed: number; feet: Feet; clip: string; debug: string; phase: number }[] = [];
  let x = 0, z = 0, yaw = plan(0).yaw, speed = 0, distance = 0;
  for (let tick = 1; tick <= seconds * 60; tick++) {
    const t = tick / 60, want = plan(t);
    speed += Math.sign(want.speed - speed) * Math.min(Math.abs(want.speed - speed), 9 / 60);
    const delta = Math.atan2(Math.sin(want.yaw - yaw), Math.cos(want.yaw - yaw));
    yaw += Math.sign(delta) * Math.min(Math.abs(delta), (want.rate ?? 100) / 60);
    x += Math.cos(yaw) * speed / 60; z -= Math.sin(yaw) * speed / 60; distance += speed / 60;
    const presented = presentation.sample(1, { x, y: .7, z, yaw }, tick, 1);
    const civilian = figure.kind === 'civilian';
    const attacking = !!want.attack && tick < want.attack.until;
    const heavy = !!want.hit?.heavy && tick < want.hit.until;
    const clip = heavy ? 'knockdown' : attacking ? 'windup' : speed > 2.5 ? civilian ? 'civ-flee' : figure.tier ?? 'infected-lurch' : speed > .06 ? civilian ? 'npc-walk' : 'shamble' : civilian ? 'idle' : 'infected-idle';
    const strideScale = baked.strideScale * scale;
    const phase = ['civ-flee', 'npc-walk', 'shamble', 'infected-frail', 'infected-lurch', 'infected-sprint'].includes(clip) ? gait.sample(1, distance, clip, strideScale, speed) : attacking ? Math.min(1, 1 - (want.attack!.until - tick) / 36) : heavy ? Math.min(1, (tick - want.hit!.started) / 42) : (t / 2) % 1;
    transform.makeRotationY(presented.yaw).scale(sc.setScalar(scale)).setPosition(presented.x, 0, presented.z);
    let frame = civilianClips.indexOf(clip as typeof civilianClips[number]) * framesPerClip + phase * (framesPerClip - 1);
    const blend = palette.sample(1, clip, frame, t);
    footwork.begin(t);
    let layers: CrowdLayers | undefined, style: GaitStyle | undefined;
    if (!civilian) {
      const e = { id: 7, health: { current: 10 }, combat: want.hit ? { reaction: { index: 1, started: want.hit.started, until: want.hit.until, direction: { x: -Math.cos(yaw), z: Math.sin(yaw) }, from: { x, z }, to: { x, z }, heavy: !!want.hit.heavy } } : undefined } as unknown as EntitySnapshot;
      const moved = speed > .06 && !attacking && !heavy;
      ({ layers, style } = moves.sample(e, attacking ? 'attack' : 'chase', want.attack?.until ?? 0, .6, tick, presented.yaw, speed, moved ? clip : undefined));
    }
    frame = loco.present(1, palette, frame, blend, clip, phase, transform, strideScale, speed, t, near, layers, style);
    const pose = palette.pose(frame, blend[0], blend[1]);
    const feet = feetParts.map(index => {
      part.multiplyMatrices(transform, new Matrix4().fromArray(pose, index * 16)); part.decompose(p, q, sc);
      const heel = new Vector3(-.05 * s, -sole, 0).applyQuaternion(q).add(p), toe = new Vector3(.085 * s, -sole, 0).applyQuaternion(q).add(p);
      const forward = new Vector3(1, 0, 0).applyQuaternion(q);
      return { heel, toe, yaw: Math.atan2(-forward.z, forward.x) };
    });
    sc.setScalar(1);
    const contacts = footwork.states.get(1)?.contacts as unknown as { feet: { locked: boolean; target: Vector3; ik: { end: import('three').Object3D }; swing?: { u: number; gait: boolean } }[] } | undefined;
    const debug = contacts?.feet.map(f => (f.locked ? 'L' : f.swing ? `${f.swing.gait ? 'g' : 't'}${f.swing.u.toFixed(2)}` : '?') + (process.env.FOOT_DEBUG ? `@${(f.target.y * 100).toFixed(1)}/${(f.ik.end.getWorldPosition(new Vector3()).distanceTo(f.target) * 100).toFixed(1)}` : '')).join(' ') ?? '-';
    frames.push({ t, speed, feet, clip, debug, phase });
  }
  palette.texture.dispose(); baked.geometry.dispose();
  return frames;
}
/** Same model-free contact metric as tools/playeranim/metrics.ts. */
export function metrics(frames: Awaited<ReturnType<typeof drive>>, from = .5) {
  const used = frames.filter(f => f.t >= from && !['knockdown', 'get-up'].includes(f.clip)), floor = Math.min(...used.flatMap(f => f.feet.flatMap(c => [c.heel.y, c.toe.y])));
  const slides: number[] = [], drifts: number[] = [];
  let lift = 0;
  for (let i = 0; i < 2; i++) {
    let slide = 0, drift = 0, startYaw: number | undefined, previous: (typeof used)[number] | undefined;
    for (const f of used) {
      const c = f.feet[i], lowest = Math.min(c.heel.y, c.toe.y); lift = Math.max(lift, lowest - floor);
      if (lowest < floor + .012) {
        if (startYaw === undefined) startYaw = c.yaw;
        else if (previous) {
          const pc = previous.feet[i], toeGrounded = c.toe.y < floor + .012 && pc.toe.y < floor + .012;
          const a = toeGrounded ? c.toe : c.heel, b = toeGrounded ? pc.toe : pc.heel;
          slide += Math.hypot(a.x - b.x, a.z - b.z);
          drift = Math.max(drift, Math.abs(Math.atan2(Math.sin(c.yaw - startYaw), Math.cos(c.yaw - startYaw))) * 180 / Math.PI);
        }
        previous = f;
      } else if (startYaw !== undefined) { slides.push(slide); drifts.push(drift); slide = 0; drift = 0; startYaw = undefined; previous = undefined; }
    }
    if (startYaw !== undefined) { slides.push(slide); drifts.push(drift); }
  }
  return { contacts: slides.length, slideMaxCm: +(Math.max(0, ...slides) * 100).toFixed(2), yawDriftMaxDeg: +Math.max(0, ...drifts).toFixed(2), liftMaxCm: +(lift * 100).toFixed(1) };
}
const turn = (from: number, to: number, at: number) => (t: number) => t < at ? from : to;
/** Seeded wander: every 0.6 s a new speed (stand / walk / run) and a heading snap up to ±150°. */
export const wander = (speeds: number[], seed: number) => {
  const plan: { speed: number; yaw: number }[] = []; let r = seed, yaw = 0;
  const next = () => (r = (r * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 20; i++) { yaw += (next() - .5) * 5.2; plan.push({ speed: speeds[Math.floor(next() * speeds.length)], yaw }); }
  return (t: number) => plan[Math.min(plan.length - 1, Math.floor(t / .6))];
};
export const scenarios = {
  civilian: {
    'walk 1.4 m/s': () => ({ speed: 1.4, yaw: 0 }),
    'walk turn 90°': (t: number) => ({ speed: 1.4, yaw: turn(0, Math.PI / 2, 1.5)(t) }),
    'walk turn 180°': (t: number) => ({ speed: 1.4, yaw: turn(0, Math.PI, 1.5)(t) }),
    'turn in place 180°': (t: number) => ({ speed: 0, yaw: turn(0, Math.PI, 1)(t) }),
    'start-stop': (t: number) => ({ speed: t > .6 && t < 2.2 ? 1.4 : 0, yaw: 0 }),
    'flee 4 m/s': () => ({ speed: 4, yaw: 0 }),
    'flee turn 120°': (t: number) => ({ speed: 4, yaw: turn(0, 2.1, 1.5)(t) }),
    'wander (seeded)': wander([0, 1.4, 1.4, 4], 7),
  },
  infected: {
    'shamble 1 m/s (drag foot)': () => ({ speed: 1, yaw: 0 }),
    'shamble turn 90°': (t: number) => ({ speed: 1, yaw: turn(0, Math.PI / 2, 1.5)(t) }),
    'runner lurch 5.1 m/s': () => ({ speed: 5.1, yaw: 0 }),
    'runner turn 90°': (t: number) => ({ speed: 5.1, yaw: turn(0, Math.PI / 2, 1.5)(t) }),
    'face target 150° (snap)': (t: number) => ({ speed: 0, yaw: turn(0, 2.6, 1)(t) }),
    'lunge-grab attack': (t: number) => ({ speed: 0, yaw: 0, attack: t > .8 && t < 2 ? { until: Math.round(1.4 * 60) } : undefined }),
    'wander (seeded)': wander([0, 1, 1, 5.1], 11),
    'flinch x4 (fast clicks)': (t: number) => { const hit = [1, 1.3, 1.6, 1.9].filter(h => t >= h).pop(); return { speed: 0, yaw: 0, hit: hit ? { started: Math.round(hit * 60), until: Math.round(hit * 60) + 15 } : undefined }; },
  },
} as const;

