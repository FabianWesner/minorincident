import type { AnimationState } from '../../data/survivor';
import type { CharacterRig } from './rig';
export type Clip = (rig: CharacterRig, seconds: number) => void;
const stride = (rig: CharacterRig, seconds: number, amplitude: number, frequency: number): void => {
  const phase = seconds * Math.PI * frequency, swing = Math.sin(phase) * amplitude;
  rig.legL.rotation.z += swing; rig.legR.rotation.z -= swing;
  rig.shinL.rotation.z -= Math.max(0, -Math.sin(phase)) * amplitude; rig.shinR.rotation.z -= Math.max(0, Math.sin(phase)) * amplitude;
  rig.armL.rotation.z -= swing * 0.7; rig.armR.rotation.z += swing * 0.7;
  rig.foreArmL.rotation.z += 0.15; rig.foreArmR.rotation.z += 0.15;
  rig.hip.position.y += Math.abs(Math.sin(phase)) * amplitude * 0.025;
};
/** Complete sim → clip table. Angles rotate rigid joints; weapons remain on hand sockets. */
export const clips: Record<AnimationState, Clip> = {
  idle: (r, t) => { r.torso.rotation.z += Math.sin(t * 2.5) * 0.018; },
  walk: (r, t) => stride(r, t, 0.3, 3),
  run: (r, t) => { stride(r, t, 0.65, 5); r.torso.rotation.z -= 0.1; },
  hurt: (r, t) => { r.torso.rotation.z += Math.sin(Math.min(1, t / 0.3) * Math.PI) * 0.3; r.head.rotation.z -= 0.15; },
  die: (r, t) => { const phase = Math.min(1, t / 0.6); r.hip.rotation.z += phase * Math.PI / 2; r.hip.position.y -= phase * 0.4; },
  swing: (r, t) => { const p = Math.min(1, t / 0.5); r.torso.rotation.y += Math.sin(p * Math.PI) * 0.35; r.armR.rotation.z += Math.sin(p * Math.PI * 1.5) * 1.8; r.foreArmR.rotation.z += 0.5; },
  shoot: (r, t) => { r.armR.rotation.z += Math.PI / 2 - Math.sin(Math.min(1, t / 0.2) * Math.PI) * 0.15; r.foreArmR.rotation.z += 0.1; },
  throw: (r, t) => { const p = Math.min(1, t / 0.6); r.armR.rotation.z += (1 - p) * 2.5; r.foreArmR.rotation.z += Math.sin(p * Math.PI) * 1.2; },
  kick: (r, t) => { r.legR.rotation.z += Math.sin(Math.min(1, t / 0.5) * Math.PI) * 1.3; r.torso.rotation.z += 0.15; },
  interact: (r, t) => { r.torso.rotation.z -= 0.15; r.armL.rotation.z += 0.8 + Math.sin(t * 12) * 0.08; r.armR.rotation.z += 0.8; },
  'enter-car': (r, t) => { const p = Math.min(1, t); r.hip.position.y -= p * 0.2; r.legL.rotation.z += p * 1.4; r.legR.rotation.z += p * 1.4; r.shinL.rotation.z -= p * 1.4; r.shinR.rotation.z -= p * 1.4; },
};
