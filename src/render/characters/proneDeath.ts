import { Matrix4, Quaternion, Vector3 } from 'three';
import type { CrowdClip } from '../../assets/crowd';
import { framesPerClip, infectedClips } from './bakeInfected';

/**
 * P1-117 (PO 10-22 "Alpha looks terrible"): an Alpha that died on its back showed its open maw, glowing eye
 * patches, blood strands and shirt shards straight to the camera, which reads as broken geometry. Its back
 * (jacket, hood, hat, growths) is clean. Turn the authored backward fall into a forward one: each death-back frame
 * gets a rigid rotation about the lateral axis through the feet that mirrors the body's pitch (net pitch -θ instead
 * of +θ), plus a growing lift so the chest, not the back, ends on the ground. Limb motion stays authored.
 * Live dying figures and frozen corpses sample the same matrices, so the hand-over to the corpse page is seamless.
 */
const done = new WeakSet<CrowdClip>();
/** Distance (m) a prone body reaches in front of its feet, per clip. Corpse placement keeps that strip clear. */
export const proneReach = new WeakMap<CrowdClip, number>();

export function proneDeath(clip: CrowdClip, name: typeof infectedClips[number] = 'death-back'): void {
  if (done.has(clip)) return;
  const P = clip.parts.length, first = infectedClips.indexOf(name) * framesPerClip;
  const hip = clip.parts.indexOf('hip'), torso = clip.parts.indexOf('torso'), head = clip.parts.indexOf('head');
  const footL = clip.parts.indexOf('footL'), footR = clip.parts.indexOf('footR');
  if (clip.frames !== infectedClips.length * framesPerClip || [hip, torso, head, footL, footR].some(i => i < 0)) return;
  done.add(clip);
  const m = clip.matrices;
  const at = (frame: number, part: number, out: Vector3) => { const o = (frame * P + part) * 16; return out.set(m[o + 12], m[o + 13], m[o + 14]); };
  const a = new Vector3(), b = new Vector3(), v = new Vector3(), up = new Vector3(0, 1, 0);
  const last = first + framesPerClip - 1;
  // Backward fall direction (hip to head on the ground) and the lateral axis.
  v.subVectors(at(last, head, a), at(last, hip, b)).setY(0);
  if (v.lengthSq() < 1e-6) return;
  const d = v.normalize().clone(), lateral = new Vector3().crossVectors(up, d).normalize();
  const pitch = (frame: number) => { v.subVectors(at(frame, head, a), at(frame, hip, b)); return Math.atan2(v.dot(d), v.y); };
  const end = pitch(last);
  if (end < .5) return;
  const rotation = new Matrix4(), transform = new Matrix4(), part = new Matrix4(), pivot = new Vector3();
  const frameTransform = (frame: number, lift: number) => {
    const theta = Math.max(0, pitch(frame)), s = Math.min(1, theta / end);
    pivot.addVectors(at(frame, footL, a), at(frame, footR, b)).multiplyScalar(.5).setY(0);
    // Positive angles about `lateral` tip +Y toward +d: -2θ mirrors the pitch to the front.
    rotation.makeRotationAxis(lateral, -2 * theta);
    transform.makeTranslation(-pivot.x, -pivot.y, -pivot.z).premultiply(rotation);
    return transform.premultiply(part.makeTranslation(pivot.x, pivot.y + lift * s, pivot.z));
  };
  // Lift: the final hip/torso joints keep the height they had lying on the back (the chest now rests where the back did).
  const restHeight = (at(last, hip, a).y + at(last, torso, b).y) / 2;
  frameTransform(last, 0);
  const flipped = (at(last, hip, a).applyMatrix4(transform).y + at(last, torso, b).applyMatrix4(transform).y) / 2;
  const lift = restHeight - flipped;
  const flat = new Set([clip.parts.indexOf('handL'), clip.parts.indexOf('handR')]);
  const joint = new Vector3(), bend = new Matrix4();
  for (let frame = first; frame <= last; frame++) {
    const s = Math.min(1, Math.max(0, pitch(frame)) / end), t = frameTransform(frame, lift).clone();
    for (let p = 0; p < P; p++) {
      const o = (frame * P + p) * 16;
      part.fromArray(m, o).premultiply(t);
      if (flat.has(p)) {
        joint.setFromMatrixPosition(part);
        bend.makeRotationAxis(lateral, -Math.PI / 2 * s).premultiply(rotation.makeTranslation(joint.x, joint.y, joint.z)).multiply(transform.makeTranslation(-joint.x, -joint.y, -joint.z));
        part.premultiply(bend);
      }
      part.toArray(m as number[], o);
    }
  }
  groundDeathFeet(clip, name);
  // Furthest joint in front of the feet at rest (head), for the corpse-placement strip.
  pivot.addVectors(at(last, footL, a), at(last, footR, b)).multiplyScalar(.5);
  proneReach.set(clip, Math.max(0, -at(last, head, a).sub(pivot).dot(d)));
}

const grounded = new WeakMap<CrowdClip, Set<string>>();
/** Settle the lower legs without changing shin length, then level the boot soles; also used by the Mega's side fall. */
export function groundDeathFeet(clip: CrowdClip, name: typeof infectedClips[number]): void {
  if (grounded.get(clip)?.has(name)) return;
  const P = clip.parts.length, first = infectedClips.indexOf(name) * framesPerClip, last = first + framesPerClip - 1;
  const footL = clip.parts.indexOf('footL'), footR = clip.parts.indexOf('footR'), hip = clip.parts.indexOf('hip'), head = clip.parts.indexOf('head');
  if (clip.frames !== infectedClips.length * framesPerClip || [footL, footR, hip, head].some(i => i < 0)) return;
  const names = grounded.get(clip) ?? new Set<string>(); names.add(name); grounded.set(clip, names);
  const m = clip.matrices, a = new Vector3(), b = new Vector3(), up = new Vector3(0, 1, 0);
  const at = (frame: number, part: number, out: Vector3) => out.fromArray(m, (frame * P + part) * 16 + 12);
  const d = at(last, hip, a).sub(at(last, head, b)).setY(0).normalize().clone();
  if (d.lengthSq() < 1e-6) return;
  const legs = [footL, footR].map((foot, i) => ({ foot, thigh: clip.parts.indexOf(i ? 'legR' : 'legL'), shin: clip.parts.indexOf(i ? 'shinR' : 'shinL'), height: at(first, foot, a).y }));
  const thighPose = new Matrix4(), shinPose = new Matrix4(), footPose = new Matrix4(), bend = new Matrix4(), rotation = new Matrix4(), transform = new Matrix4();
  const knee = new Vector3(), ankle = new Vector3(), delta = new Vector3(), target = new Vector3(), scale = new Vector3(), joint = new Vector3();
  const origin = new Vector3(), axis = new Vector3(), pole = new Vector3(), solvedKnee = new Vector3(), solvedAnkle = new Vector3();
  const turn = new Quaternion(), footRotation = new Quaternion();
  const levelFoot = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(d, up, new Vector3().crossVectors(d, up)));
  for (let frame = first; frame <= last; frame++) {
    const s = Math.min(1, Math.max(0, ((frame - first) / (framesPerClip - 1) - .25) / .55));
    if (s === 0) continue;
    for (const leg of legs) {
      const footOffset = (frame * P + leg.foot) * 16;
      footPose.fromArray(m, footOffset); ankle.setFromMatrixPosition(footPose);
      const ankleY = ankle.y + (leg.height - ankle.y) * s;
      if (leg.shin >= 0) {
        const shinOffset = (frame * P + leg.shin) * 16;
        shinPose.fromArray(m, shinOffset); knee.setFromMatrixPosition(shinPose);
        if (leg.thigh >= 0) {
          const thighOffset = (frame * P + leg.thigh) * 16;
          thighPose.fromArray(m, thighOffset); origin.setFromMatrixPosition(thighPose);
          const upper = origin.distanceTo(knee), lower = knee.distanceTo(ankle), reach = upper + lower - .0001;
          const dy = Math.max(-reach, Math.min(reach, ankleY - origin.y));
          target.subVectors(ankle, origin).setY(0); if (target.lengthSq() < 1e-6) target.copy(d);
          target.setLength(Math.min(target.length(), Math.sqrt(Math.max(0, reach * reach - dy * dy)))).setY(dy);
          const distance = Math.max(.0001, target.length()); axis.copy(target).normalize(); solvedAnkle.copy(origin).add(target);
          // Same two-bone construction as LimbIK: keep segment lengths and the authored knee's bend plane.
          pole.subVectors(knee, origin).addScaledVector(axis, -delta.subVectors(knee, origin).dot(axis));
          if (pole.lengthSq() < 1e-6) pole.copy(up).addScaledVector(axis, -up.dot(axis));
          pole.normalize();
          const along = (upper * upper + distance * distance - lower * lower) / (2 * distance);
          solvedKnee.copy(origin).addScaledVector(axis, along).addScaledVector(pole, Math.sqrt(Math.max(0, upper * upper - along * along)));
          turn.setFromUnitVectors(delta.subVectors(knee, origin).normalize(), target.subVectors(solvedKnee, origin).normalize());
          bend.makeTranslation(origin.x, origin.y, origin.z).multiply(rotation.makeRotationFromQuaternion(turn)).multiply(transform.makeTranslation(-origin.x, -origin.y, -origin.z));
          thighPose.premultiply(bend).toArray(m as number[], thighOffset); shinPose.premultiply(bend); footPose.premultiply(bend);
          knee.setFromMatrixPosition(shinPose); ankle.setFromMatrixPosition(footPose);
          turn.setFromUnitVectors(delta.subVectors(ankle, knee).normalize(), target.subVectors(solvedAnkle, knee).normalize());
          bend.makeTranslation(knee.x, knee.y, knee.z).multiply(rotation.makeRotationFromQuaternion(turn)).multiply(transform.makeTranslation(-knee.x, -knee.y, -knee.z));
          shinPose.premultiply(bend).toArray(m as number[], shinOffset); footPose.premultiply(bend);
        } else {
        delta.subVectors(ankle, knee); const length = delta.length();
        if (length > 1e-5) {
          const dy = Math.max(-length, Math.min(length, ankleY - knee.y));
          target.copy(delta).setY(0); if (target.lengthSq() < 1e-6) target.copy(d);
          target.normalize().multiplyScalar(Math.sqrt(Math.max(0, length * length - dy * dy))).setY(dy);
          turn.setFromUnitVectors(delta.normalize(), target.normalize());
          bend.makeTranslation(knee.x, knee.y, knee.z).multiply(rotation.makeRotationFromQuaternion(turn)).multiply(transform.makeTranslation(-knee.x, -knee.y, -knee.z));
          shinPose.premultiply(bend).toArray(m as number[], shinOffset); footPose.premultiply(bend);
        }
        }
      } else footPose.elements[13] = ankleY;
      footPose.decompose(joint, footRotation, scale);
      footPose.compose(joint, footRotation.slerp(levelFoot, s), scale).toArray(m as number[], footOffset);
    }
  }
}
