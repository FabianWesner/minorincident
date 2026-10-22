import { Matrix4, Vector3 } from 'three';
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
  // Flipped, the back-fall's claws and boot toes point straight up/down. Lay hands and feet flat:
  // fingers forward along the ground, soles facing up (toes pointing away from the head).
  const flat = new Set([clip.parts.indexOf('handL'), clip.parts.indexOf('handR'), footL, footR]);
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
  // Furthest joint in front of the feet at rest (head), for the corpse-placement strip.
  pivot.addVectors(at(last, footL, a), at(last, footR, b)).multiplyScalar(.5);
  proneReach.set(clip, Math.max(0, -at(last, head, a).sub(pivot).dot(d)));
}
