import { Euler, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three';
import type { CrowdClip } from '../../assets/crowd';
import { civilianClips, framesPerClip, infectedClips } from './bakeInfected';
import { premultiplyRow, skinnedVertexMatrix } from './skinnedCrowd';

/**
 * r2-corpse (G-14, L4-17). The authored death clips end in poses the rigs cannot carry: the hip 0.6 m above the floor,
 * knees and elbows folded to points, wrists bent at the sky and the Alpha's arm joints sitting a metre away from the
 * mesh limbs they drive (pointed or folded limbs, 1.5-1.9 m tall corpses). Every humanoid death clip is therefore
 * re-posed once on the clip matrices: the end pose is the model's own rest pose (the pose its skin weights were built
 * for) rigidly laid on the floor, with each whole limb (arm+forearm+hand, leg+shin+foot) turned as one rigid unit about
 * its shoulder/hip so its real mesh axis lies flat. No limb can fold and no skin triangle can stretch. The authored
 * fall is blended into it (weight s per frame), which keeps the live dying figure and the frozen corpse on the same
 * rows and the hand-over seamless.
 *   death-back    face up, arms and legs slightly open, head toward -x (Alphas, `prone`: face down; their front shows
 *                 the maw and glowing growths)
 *   death-side    face up, one arm out, legs apart (the asymmetric variant)
 *   death-crumple face down, arms thrown up beside the head
 * The lowest drawn vertex of the real geometry is then set on the floor, so a corpse neither floats nor sinks.
 * Mesh, skin weights, UVs and triangle counts are untouched.
 */
const deaths = ['death-back', 'death-side', 'death-crumple'] as const;
type Death = typeof deaths[number];
const humanoid = ['hip', 'torso', 'head', 'armL', 'armR', 'foreArmL', 'foreArmR', 'handL', 'handR', 'legL', 'legR', 'shinL', 'shinR', 'footL', 'footR'];
const repaired = new WeakMap<CrowdClip, { prone: boolean }>();
/** Distance (m) a repaired Alpha reaches from its feet along the floor; corpse placement keeps that strip clear. */
export const deathReach = new WeakMap<CrowdClip, number>();

const smooth = (t: number) => t * t * (3 - 2 * t);
/** Share of the lying pose at `frame` of a death clip that starts at `first`: the fall plays, then settles. */
export const deathWeight = (frame: number, first: number) => smooth(Math.max(0, Math.min(1, ((frame - first) / (framesPerClip - 1) - .2) / .6)));

/** Rotation that lays a standing rest figure (up +y, face +x) on the floor with its head toward -x. */
function lying(death: Death, prone: boolean): Matrix4 {
  const toBack = new Matrix4().makeRotationZ(Math.PI / 2); // face up
  const roll = prone || death === 'death-crumple' ? Math.PI : 0;
  return new Matrix4().makeRotationFromEuler(new Euler(roll, 0, 0)).multiply(toBack);
}
/** Angle (degrees) from the feet direction at which a limb lies; side = +1 (z+) or -1. */
const spread: Record<Death, { arm: (side: number) => number; leg: (side: number) => number }> = {
  'death-back': { arm: () => 20, leg: () => 9 },
  'death-side': { arm: side => side > 0 ? 50 : 15, leg: side => side > 0 ? 24 : 4 },
  'death-crumple': { arm: () => 40, leg: () => 14 },
};
const limbs = [['armL', 'foreArmL', 'handL', 'arm', 1], ['armR', 'foreArmR', 'handR', 'arm', -1], ['legL', 'shinL', 'footL', 'leg', 1], ['legR', 'shinR', 'footR', 'leg', -1]] as const;

/** Repairs the three humanoid death clips in place. Returns false when the rig is not a human (animals keep their own fall). */
export function repairDeathPoses(clip: CrowdClip, geometry?: BufferGeometry, options: { prone?: boolean } = {}): boolean {
  const prone = !!options.prone, done = repaired.get(clip);
  if (done) return done.prone === prone;
  const names: readonly string[] | undefined = [infectedClips, civilianClips].find(list => list.length * framesPerClip === clip.frames);
  if (!names || !clip.binds) return false;
  const P = clip.parts.length, index = Object.fromEntries(clip.parts.map((name, i) => [name, i])) as Record<string, number>;
  if (humanoid.some(name => index[name] === undefined)) return false;
  // Animal rigs carry the human joints too but keep their own authored fall (quadruped joints: body/neck/tail).
  if (index.body !== undefined || index.neck !== undefined || index.legFL !== undefined) return false;
  // Only figures whose rest pose stands upright can be laid down this way (the crawler's rest pose is already on all fours).
  const restAt = (name: string) => { const w = new Matrix4().fromArray(clip.binds as unknown as number[], index[name] * 16); return new Vector3().setFromMatrixPosition(w.invert()); };
  const spineRest = restAt('head').sub(restAt('hip'));
  if (spineRest.y < 1.2 * Math.hypot(spineRest.x, spineRest.z)) return false;
  repaired.set(clip, { prone });
  const m = clip.matrices as unknown as number[], binds = clip.binds as unknown as number[];
  // Rest world matrices (inverse binds); a part without a usable bind keeps its authored pose.
  const rest = clip.parts.map((_, p) => { const w = new Matrix4().fromArray(binds, p * 16); return Math.abs(w.determinant()) > 1e-9 ? w.invert() : null; });
  // Rest axis of a limb unit: from its root joint to the centre of the vertices owned by the unit's parts.
  const axes = new Map<number, Vector3>();
  const limbAxis = (root: number, unit: number[], origin = root): Vector3 => {
    const key = root * 100 + unit[0]; const cached = axes.get(key); if (cached) return cached.clone();
    const out = new Vector3(), joint = new Vector3().setFromMatrixPosition(rest[origin] ?? new Matrix4());
    if (geometry && prone) {
      const position = geometry.getAttribute('position'), parts = geometry.getAttribute('_parts') ?? geometry.getAttribute('_part_index');
      const emissive = geometry.getAttribute('_emissive'), vein = geometry.getAttribute('_vein'), packed = !!geometry.getAttribute('_parts');
      let n = 0;
      if (position && parts) for (let i = 0; i < position.count; i++) {
        if (!unit.includes(parts.getX(i))) continue;
        const z = packed ? parts.getZ(i) : emissive?.getX(i) ?? 0, w = packed ? parts.getW(i) : vein?.getX(i) ?? 0;
        if (z > 1.5 || w >= 1024) continue;
        out.x += position.getX(i); out.y += position.getY(i); out.z += position.getZ(i); n++;
      }
      if (n) out.multiplyScalar(1 / n).sub(joint);
    }
    if (out.length() < .05) { const end = rest[unit[unit.length - 1]]; if (end) out.setFromMatrixPosition(end).sub(joint); }
    axes.set(key, out.clone()); return out;
  };
  const current = new Matrix4(), target = new Matrix4(), p1 = new Vector3(), p2 = new Vector3(), s1 = new Vector3(), s2 = new Vector3(), q1 = new Quaternion(), q2 = new Quaternion();
  for (const death of deaths) {
    const first = names.indexOf(death) * framesPerClip, last = first + framesPerClip - 1, lie = lying(death, prone);
    // Lay the rest pose on the floor, then find how far its lowest real vertex is from y = 0.
  const lay = (tilts: number[], pitch = 0, exact = false) => {
    const lifted = rest.map(w => w ? lie.clone().multiply(w) : null);
    const reach: number[] = [], heights: number[] = [];
    // Turn each limb as one rigid unit about its root joint so its mesh axis (root joint to the centre of its vertices) lies flat.
    const hipAt = new Vector3().setFromMatrixPosition(lifted[index.hip]!);
    // A hunched rest pose (Alpha) leans the chest 40-60 degrees off the pelvis: straighten the upper body about the hip first.
    const upper = ['torso', 'head', 'armL', 'foreArmL', 'handL', 'armR', 'foreArmR', 'handR'].map(name => index[name]);
    const spine = limbAxis(index.hip, [index.torso, index.head], index.hip).applyMatrix4(new Matrix4().extractRotation(lie));
    let straighten = new Matrix4();
    // Only a hunched rest pose (Alpha) needs it; an upright figure turned about the hip shears the skirt/apron/shirt hem skinned to the torso against its thighs.
    const tilt0 = Math.atan2(Math.hypot(spineRest.x, spineRest.z), spineRest.y);
    if (spine.lengthSq() > 1e-8 && (prone || tilt0 > .8)) {
      const turnUp = new Matrix4().makeRotationFromQuaternion(new Quaternion().setFromUnitVectors(spine.normalize(), new Vector3(-1, 0, 0)));
      straighten = new Matrix4().makeTranslation(hipAt.x, hipAt.y, hipAt.z).multiply(turnUp).multiply(new Matrix4().makeTranslation(-hipAt.x, -hipAt.y, -hipAt.z));
    }
    // `pitch` lowers the head end about the hip (about +z, head toward -x): searched below for the flattest body.
    if (pitch) straighten = new Matrix4().makeTranslation(hipAt.x, hipAt.y, hipAt.z).multiply(new Matrix4().makeRotationZ(pitch)).multiply(new Matrix4().makeTranslation(-hipAt.x, -hipAt.y, -hipAt.z)).multiply(straighten);
    for (const p of upper) lifted[p]!.premultiply(straighten);
    const straightenRotation = new Matrix4().extractRotation(straighten);
    limbs.forEach(([root, mid, end, kind, nominal], limbIndex) => {
      const unit = [index[root], index[mid], index[end]], joint = new Vector3().setFromMatrixPosition(lifted[index[root]]!);
      const side = Math.sign(joint.z - hipAt.z) || nominal;
      const axis = limbAxis(index[root], unit).applyMatrix4(new Matrix4().extractRotation(lie));
      if (kind === 'arm') axis.applyMatrix4(straightenRotation);
      if (axis.lengthSq() < 1e-8) { reach[limbIndex] = 0; heights[limbIndex] = joint.y; return; }
      reach[limbIndex] = 2 * axis.length(); heights[limbIndex] = joint.y;
      const angle = (kind === 'arm' ? spread[death].arm(side) : spread[death].leg(side)) * Math.PI / 180;
      const tilt = tilts[limbIndex] ?? 0, want = new Vector3(Math.cos(tilt) * Math.cos(angle), -Math.sin(tilt), Math.cos(tilt) * side * Math.sin(angle));
      const full = new Quaternion().setFromUnitVectors(axis.normalize(), want), swing = axis.angleTo(want), limit = (prone ? 180 : kind === "arm" ? 25 : 12) * Math.PI / 180;
      const turn = new Matrix4().makeRotationFromQuaternion(swing > limit ? new Quaternion().slerp(full, limit / swing) : full);
      const about = new Matrix4().makeTranslation(joint.x, joint.y, joint.z).multiply(turn).multiply(new Matrix4().makeTranslation(-joint.x, -joint.y, -joint.z));
      for (const p of unit) lifted[p]!.premultiply(about);
    });
    let drop = 0, extent = 0;
    if (geometry && geometry.getAttribute('_skin')) {
      const position = geometry.getAttribute('position'), skin = geometry.getAttribute('_skin');
      const parts = geometry.getAttribute('_parts') ?? geometry.getAttribute('_part_index'), packed = !!geometry.getAttribute('_parts');
      const emissive = geometry.getAttribute('_emissive'), vein = geometry.getAttribute('_vein');
      const poseRows = new Float32Array(P * 16), row = new Float32Array(16);
      const scratch = { matrices: new Float32Array(P * 16), binds: clip.binds, parts: clip.parts, frames: 1, duration: 0 } as unknown as CrowdClip;
      lifted.forEach((w, p) => (w ?? new Matrix4().fromArray(m, last * P * 16 + p * 16)).toArray(scratch.matrices as unknown as number[], p * 16));
      premultiplyRow(scratch.matrices, poseRows, clip.binds!, 0, P, 0);
      let low = Infinity, high = -Infinity; const step = exact ? 1 : Math.max(1, Math.floor(position.count / 2500));
      for (let i = 0; i < position.count; i += step) {
        const z = packed ? parts!.getZ(i) : emissive?.getX(i) ?? 0, w = packed ? parts!.getW(i) : vein?.getX(i) ?? 0;
        if (z > 1.5 || w >= 1024) continue;
        const f = skinnedVertexMatrix(scratch, 0, parts as never, skin as never, i, row, poseRows);
        const y = f[1] * position.getX(i) + f[5] * position.getY(i) + f[9] * position.getZ(i) + f[13];
        if (y < low) low = y; if (y > high) high = y;
      }
      if (Number.isFinite(low)) { drop = -low; extent = high - low; }
    }
    return { lifted, drop, reach, heights, extent };
  };
  // First pass flat; second pass lets each limb slope down until its end meets the floor. A body still thicker than 0.9 m
  // (the hunched Alpha) also tries lowering the head end, and keeps the flattest result.
  const settle = (pitch: number) => {
    const flat = lay([], pitch);
    const tilts = flat.reach.map((length, k) => length > 0 ? Math.asin(Math.max(0, Math.min(prone ? .85 : .5, (flat.heights[k] + flat.drop - .15 * length) / length))) : 0);
    return { ...(geometry ? lay(tilts, pitch) : flat), tilts, pitch };
  };
  let best = settle(0);
  if (geometry) for (const degrees of [10, 20, 30, 40, 50]) {
    if (best.extent < (prone ? .9 : 1)) break;
    const tried = settle(degrees * Math.PI / 180);
    if (tried.extent < best.extent - (prone ? .01 : .1)) best = tried;
  }
  // The search samples ~2500 vertices; the floor itself is fitted on every vertex of the chosen pose.
  const { lifted, drop } = geometry ? lay(best.tilts, best.pitch, true) : best;
    for (let frame = first; frame <= last; frame++) {
      const s = deathWeight(frame, first);
      if (s < 1e-3) continue;
      for (let p = 0; p < P; p++) {
        const w = lifted[p]; if (!w || clip.parts[p] === 'root') continue;
        current.fromArray(m, (frame * P + p) * 16);
        target.copy(w).premultiply(new Matrix4().makeTranslation(0, drop, 0));
        current.decompose(p1, q1, s1); target.decompose(p2, q2, s2);
        current.compose(p1.lerp(p2, s), q1.slerp(q2, s), s1.lerp(s2, s)).toArray(m, (frame * P + p) * 16);
      }
    }
  }
  // Alpha corpse-placement strip: furthest joint from the feet along the floor in the face-down pose.
  const last = names.indexOf('death-back') * framesPerClip + framesPerClip - 1;
  const feet = new Vector3().fromArray(m, (last * P + index.footL) * 16 + 12).add(new Vector3().fromArray(m, (last * P + index.footR) * 16 + 12)).multiplyScalar(.5);
  let reach = 0;
  for (const name of ['head', 'handL', 'handR']) reach = Math.max(reach, Math.hypot(m[(last * P + index[name]) * 16 + 12] - feet.x, m[(last * P + index[name]) * 16 + 14] - feet.z));
  deathReach.set(clip, reach);
  return true;
}
