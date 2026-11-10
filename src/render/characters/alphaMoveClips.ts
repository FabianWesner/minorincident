import { Euler, Quaternion, Vector3 } from 'three';

/**
 * r32-alphas (PO 2026-11-10: "Make sure each type of alpha has it's own signature attacks and special moves. Right now they
 * all the same."): the humanoid Alpha move set, authored as key poses and compiled to the library clip schema (node TRS tracks,
 * translation relative to rest) so the crowd bake samples them like the Blender actions.
 *
 * The five Alpha looks share one skinned rig whose rest is the hunched brute stance (identity joint rotations, arms bent out
 * wide, knees bent; offsets below from public/assets/models/skinned/inf.alpha.lod0.glb). Library deltas authored for the
 * arms-down library rest therefore swing these arms the wrong way, so keys here name what the body does instead: torso/head
 * Euler offsets (degrees, model axes: +X forward, +Y up, +Z the right side; torso +Z leans back), upper-arm and forearm
 * directions (torso frame unless `world`), and ankle targets relative to the rest stance (two-bone leg IK keeps planted feet
 * on the floor while the pelvis drops). Each clip spans phase 0..1; AlphaMoves maps the sim stages onto it.
 */
type V3 = readonly [number, number, number];
interface Pose {
  hip?: V3; torso?: V3; head?: V3;
  armR?: V3; foreArmR?: V3; armL?: V3; foreArmL?: V3;
  /** Arm directions are model/world directions (hands to the ground while the torso is bowed). */
  world?: boolean;
  footR?: V3; footL?: V3;
}
type Key = readonly [t: number, pose: Pose];
const v = (a: V3) => new Vector3(a[0], a[1], a[2]);
const mirror = (a: V3 | undefined): V3 | undefined => a && [a[0], a[1], -a[2]];
/** Alpha rig rest offsets (parent -> joint), model axes. */
const rest = {
  hip: v([0, .916, 0]), torso: v([0, .237, 0]), head: v([.258, .52, 0]),
  armR: v([.109, .375, .425]), foreArmR: v([.196, -.171, .241]), handR: v([.264, .059, .156]),
  legR: v([0, .022, .222]), shinR: v([.227, -.387, .093]), footR: v([-.229, -.278, .039]),
};
const side = (offset: Vector3, left: boolean) => left ? offset.clone().setZ(-offset.z) : offset.clone();

const q = () => new Quaternion();
const arc = (from: Vector3, to: Vector3) => q().setFromUnitVectors(from.clone().normalize(), to.clone().normalize());
const eulerQ = (e: V3 | undefined) => e ? q().setFromEuler(new Euler(e[0] * Math.PI / 180, e[1] * Math.PI / 180, e[2] * Math.PI / 180)) : q();

/** Two-bone leg in the hip frame: thigh/shin rotations that put the ankle on `ankle` (knee bends forward). */
function leg(hipJoint: Vector3, ankle: Vector3, left: boolean): { leg: Quaternion; shin: Quaternion; foot: Quaternion } {
  const thighRest = side(rest.shinR, left), shinRest = side(rest.footR, left), a = thighRest.length(), b = shinRest.length();
  const p = ankle.clone().sub(hipJoint), d = Math.max(Math.abs(a - b) + 1e-3, Math.min(a + b - 1e-3, p.length()));
  // The rest knee is the pole, so the rest stance solves back to exactly the rest pose.
  const dir = p.clone().normalize(), pole = thighRest.clone().normalize();
  const n = pole.sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  const angle = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))));
  const thighDir = dir.clone().multiplyScalar(Math.cos(angle)).add(n.multiplyScalar(Math.sin(angle)));
  const knee = thighDir.clone().multiplyScalar(a), shinDir = dir.clone().multiplyScalar(d).sub(knee);
  const legQ = arc(thighRest, thighDir), shinQ = arc(shinRest, shinDir.clone().applyQuaternion(legQ.clone().invert()));
  // Sole flat on the floor: undo the leg chain's world rotation.
  const foot = legQ.clone().multiply(shinQ).invert();
  return { leg: legQ, shin: shinQ, foot };
}
/** Local joint rotations + hip translation delta for one key pose. */
function solve(pose: Pose): { rot: Record<string, Quaternion>; hip: Vector3 } {
  const rot: Record<string, Quaternion> = {}, hipDelta = v(pose.hip ?? [0, 0, 0]);
  const torso = eulerQ(pose.torso); rot.torso = torso; rot.head = eulerQ(pose.head);
  for (const left of [false, true]) {
    const s = left ? 'L' : 'R', armRest = side(rest.foreArmR, left), foreRest = side(rest.handR, left);
    const armTarget = left ? pose.armL ?? mirror(pose.armR) : pose.armR, foreTarget = left ? pose.foreArmL ?? mirror(pose.foreArmR) : pose.foreArmR;
    const toTorso = (dir: V3) => pose.world ? v(dir).applyQuaternion(torso.clone().invert()) : v(dir);
    const arm = armTarget ? arc(armRest, toTorso(armTarget)) : q();
    rot[`arm${s}`] = arm;
    // Without a forearm target the forearm keeps its rest bend relative to the upper arm.
    rot[`foreArm${s}`] = foreTarget ? arc(foreRest, toTorso(foreTarget).applyQuaternion(arm.clone().invert())) : q();
    const hipJoint = side(rest.legR, left).add(hipDelta);
    const ankleRest = side(rest.legR, left).add(side(rest.shinR, left)).add(side(rest.footR, left));
    const ankle = ankleRest.add(v((left ? pose.footL : pose.footR) ?? [0, 0, 0]));
    const solved = leg(hipJoint, ankle, left);
    rot[`leg${s}`] = solved.leg; rot[`shin${s}`] = solved.shin; rot[`foot${s}`] = solved.foot;
  }
  return { rot, hip: hipDelta };
}

const neutral: Pose = {};
/** Ordinary strike, split 0.5: coil (shoulders twisted back, claw cocked high, staggered stance) -> lunge and rake -> bite snap -> recover. */
const strike: Key[] = [
  [0, neutral],
  [.45, { hip: [-.05, -.08, 0], torso: [0, 26, 10], head: [0, -18, -8], armR: [-.5, .5, .6], foreArmR: [.2, .9, .3], armL: [.8, -.1, -.5], foreArmL: [1, .2, -.2], footR: [-.15, 0, 0], footL: [.12, 0, 0] }],
  [.5, { hip: [-.07, -.1, 0], torso: [0, 30, 12], head: [0, -20, -8], armR: [-.6, .6, .5], foreArmR: [.1, .95, .3], armL: [.8, -.1, -.5], foreArmL: [1, .2, -.2], footR: [-.15, 0, 0], footL: [.12, 0, 0] }],
  [.62, { hip: [.2, -.14, 0], torso: [0, -30, -32], head: [0, 12, 14], armR: [1, .3, .05], foreArmR: [.9, -.1, -.35], armL: [.6, -.6, -.6], foreArmL: [.8, -.3, -.4], footR: [-.12, 0, 0], footL: [.38, 0, 0] }],
  [.75, { hip: [.22, -.16, 0], torso: [0, -18, -38], head: [0, 0, -12], armR: [.9, -.4, 0], foreArmR: [.7, -.6, -.2], armL: [1, 0, -.1], foreArmL: [.8, -.3, .4], footR: [-.12, 0, 0], footL: [.38, 0, 0] }],
  [1, { hip: [.08, -.04, 0], footL: [.18, 0, 0] }],
];
/** Brute charge, split 0.5: head lowered, arms hanging, right foot scraping back twice -> head-down rush cycle (0.5..1 loops). */
const lowered: Pose = { hip: [0, -.06, 0], torso: [0, 0, -35], head: [0, 0, 22], armR: [.5, -1, .35], foreArmR: [.6, -.8, .1] };
const runA: Pose = { hip: [0, -.05, 0], torso: [0, 0, -45], head: [0, 0, 32], armR: [-.6, -.7, .45], foreArmR: [-.2, -.6, .5], footL: [.42, 0, 0], footR: [-.42, .18, 0] };
const runB: Pose = { ...runA, footL: [-.42, .18, 0], footR: [.42, 0, 0] };
const charge: Key[] = [
  [0, neutral], [.12, lowered], [.2, { ...lowered, footR: [-.35, .06, 0] }], [.28, { ...lowered, footR: [0, 0, 0] }],
  [.36, { ...lowered, footR: [-.35, .06, 0] }], [.44, lowered], [.5, runA], [.75, runB], [1, runA],
];
/** Brute ground slam, split 0.55: both fists raised overhead, back arched -> both fists into the ground, deep squat -> rise. */
const overhead: Pose = { hip: [0, .02, 0], torso: [0, 0, 15], head: [0, 0, 15], armR: [.1, 1, .25], foreArmR: [-.1, 1, -.1] };
const slammed: Pose = { hip: [.1, -.36, 0], torso: [0, 0, -55], head: [0, 0, 32], world: true, armR: [.45, -1, .25], foreArmR: [.4, -1, .05] };
const slam: Key[] = [[0, neutral], [.45, overhead], [.55, overhead], [.64, slammed], [.82, slammed], [1, { hip: [.05, -.12, 0], torso: [0, 0, -20], head: [0, 0, 10] }]];
/** Brute grab-and-throw, split 0.5: arms reach out wide (step in) -> hoist the victim overhead -> hurl to the side -> recover. */
const grab: Key[] = [
  [0, neutral],
  [.5, { hip: [.12, -.06, 0], torso: [0, 0, -20], head: [0, 0, 10], armR: [1, .15, .5], foreArmR: [1, .1, .2], footL: [.3, 0, 0] }],
  [.66, { hip: [0, .02, 0], torso: [0, 0, 12], head: [0, 0, 15], armR: [.1, 1, .2], foreArmR: [0, 1, -.25], footL: [.1, 0, 0] }],
  [.8, { hip: [.05, -.08, 0], torso: [0, -45, -20], head: [0, -25, 0], armR: [.8, .2, -.4], foreArmR: [.9, 0, -.3], armL: [.6, 0, -.8], foreArmL: [.8, -.1, -.5], footL: [.1, 0, 0] }],
  [1, { hip: [0, -.05, 0], torso: [0, -10, -10] }],
];
/** Thrower heave, split 0.6: squat and grab low -> lift the load overhead and hold (landing marker is up) -> whip it forward. */
const lifted: Pose = { hip: [0, .02, 0], torso: [0, 0, 15], head: [0, 0, 15], armR: [-.1, 1, .3], foreArmR: [-.5, .6, -.1], footR: [-.25, 0, 0] };
const heave: Key[] = [
  [0, neutral],
  [.2, { hip: [-.05, -.4, 0], torso: [0, 0, -50], head: [0, 0, 35], world: true, armR: [.6, -1, .3], foreArmR: [.5, -1, .1] }],
  [.3, { hip: [-.05, -.36, 0], torso: [0, 0, -42], head: [0, 0, 32], world: true, armR: [.6, -.8, .3], foreArmR: [.4, -.4, .1] }],
  [.52, lifted], [.6, lifted],
  [.72, { hip: [.15, -.08, 0], torso: [0, 0, -35], head: [0, 0, 15], armR: [1, .2, .25], foreArmR: [1, -.1, .05], footL: [.35, 0, 0], footR: [-.2, 0, 0] }],
  [1, { hip: [.05, -.04, 0], torso: [0, 0, -12], footL: [.15, 0, 0] }],
];
/** Screamer roar, split 0.6: deep inhale (chest up, head back, arms swept back) -> roar (jaw thrust, arms flung wide, head shaking). */
const inhale: Pose = { hip: [-.05, .03, 0], torso: [0, 0, 25], head: [0, 0, 35], armR: [-.5, -.5, .7], foreArmR: [-.3, -.3, 1] };
const roarPose = (shake: number): Pose => ({ hip: [.08, -.15, 0], torso: [0, 0, -28], head: [0, shake, 30], armR: [0, .05, 1], foreArmR: [.2, .6, 1], footR: [0, 0, .15], footL: [0, 0, -.15] });
const roar: Key[] = [[0, neutral], [.55, inhale], [.6, inhale], [.67, roarPose(0)], [.74, roarPose(12)], [.81, roarPose(-12)], [.88, roarPose(8)], [1, { hip: [0, -.05, 0], torso: [0, 0, -10], footR: [0, 0, .1], footL: [0, 0, -.1] }]];
/** Leaper pounce, split 0.5 / 0.75: coil into a deep crouch (hands on the ground, eyes up) -> stretched flight -> pin and bite. */
const coiled: Pose = { hip: [-.1, -.42, 0], torso: [0, 0, -45], head: [0, 0, 50], world: true, armR: [.7, -1, .35], foreArmR: [.6, -1, .15] };
const flight: Pose = { torso: [0, 0, -70], head: [0, 0, 60], world: true, armR: [1, .15, .3], foreArmR: [1, .1, .1], footR: [-.6, .35, 0], footL: [-.45, .25, 0] };
const pinned = (head: number): Pose => ({ hip: [.15, -.35, 0], torso: [0, 0, -55], head: [0, 0, head], world: true, armR: [.8, -1, .35], foreArmR: [.9, -.6, .1] });
const pounce: Key[] = [[0, neutral], [.4, coiled], [.5, coiled], [.57, flight], [.72, flight], [.8, pinned(35)], [.86, pinned(2)], [.92, pinned(35)], [1, pinned(10)]];
/** Armoured shield bash, split 0.6: forearm guard up in front, left shoulder leading -> shoulder-first ram -> recover. */
const guard: Pose = { hip: [0, -.12, 0], torso: [0, -30, -10], head: [0, 25, 0], armL: [.6, -.5, -.6], foreArmL: [.2, .95, .25], armR: [-.4, -.6, .7], foreArmR: [.3, .3, .9], footL: [.3, 0, 0], footR: [-.2, 0, 0] };
const rammed: Pose = { hip: [.3, -.14, 0], torso: [0, -40, -25], head: [0, 30, 10], armL: [.9, -.2, -.4], foreArmL: [.3, .9, .3], armR: [-.4, -.6, .7], foreArmR: [.3, .3, .9], footL: [.55, 0, 0], footR: [-.1, 0, 0] };
const bash: Key[] = [[0, neutral], [.5, guard], [.6, guard], [.68, rammed], [.8, rammed], [1, { hip: [.1, -.06, 0], torso: [0, -10, -5], footL: [.2, 0, 0] }]];

const sources: Record<string, readonly Key[]> = { 'alpha-strike': strike, 'alpha-charge': charge, 'alpha-slam': slam, 'alpha-grab': grab, 'alpha-heave': heave, 'alpha-roar': roar, 'alpha-pounce': pounce, 'alpha-bash': bash };
const joints = ['torso', 'head', 'armL', 'armR', 'foreArmL', 'foreArmR', 'legL', 'legR', 'shinL', 'shinR', 'footL', 'footR'] as const;
const fps = 30, duration = 1, round = (n: number) => Math.round(n * 100000) / 100000;
const smooth = (u: number) => u * u * (3 - 2 * u);
function compile(name: string, keys: readonly Key[]) {
  const solved = keys.map(([t, pose]) => ({ t, ...solve(pose) }));
  const times: number[] = [];
  for (let f = 0; f <= fps * duration; f++) times.push(round(f / fps));
  const sample = (t: number) => {
    let i = 0; while (i < solved.length - 2 && t > solved[i + 1].t) i++;
    const a = solved[i], b = solved[i + 1];
    return { a, b, u: smooth(Math.max(0, Math.min(1, (t - a.t) / Math.max(1e-6, b.t - a.t)))) };
  };
  const tracks: { node: string; path: string; times: number[]; values: number[] }[] = [];
  for (const node of joints) {
    const values: number[] = [], out = q();
    for (const t of times) { const { a, b, u } = sample(t); out.slerpQuaternions(a.rot[node], b.rot[node], u); values.push(round(out.x), round(out.y), round(out.z), round(out.w)); }
    tracks.push({ node, path: 'rotation', times, values });
  }
  const values: number[] = [], hip = new Vector3();
  for (const t of times) { const { a, b, u } = sample(t); hip.lerpVectors(a.hip, b.hip, u); values.push(round(hip.x), round(hip.y), round(hip.z)); }
  tracks.push({ node: 'hip', path: 'translation', times, values });
  return { name, duration, tracks };
}
/** Library-schema clips (same shape as library.json entries); only the humanoid Alpha looks bake them. */
export const alphaMoveClipData = Object.entries(sources).map(([name, keys]) => compile(name, keys));
