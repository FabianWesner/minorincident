import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Group, MeshLambertMaterial, Vector3, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { CharacterView } from '../../src/render/characters/CharacterView';
import { RiderContacts } from '../../src/render/characters/RiderContacts';
import { characterNodes, type SurvivorState, type SurvivorVariant } from '../../src/data/survivor';
import { meleeMoves } from '../../src/data/meleeCombos';
import type { Materials } from '../../src/render/Materials';
import type { CharacterRig } from '../../src/render/characters/rig';
import type { KeyframeAnimator } from '../../src/render/characters/KeyframeAnimator';

/** Record every 60 Hz pose, including transitions. Playback renders these exact
 * poses, allowing an honest before/after comparison after the implementation changes. */
export const scenarios = ['walk', 'run', 'start-stop', 'turn90', 'turn180', 'unarmed', 'bat', 'hurt', 'bike'] as const;
export type Scenario = typeof scenarios[number];
export type Frame = { tick: number; actor: number[]; joints: Record<string, number[]>; bike: number[] | null; pedal: number; steer: number; clip: string; speed: number; phase: number; knees: number[]; ankles: number[][]; hips: number[][]; pelvis: number[]; cpuMs: number };
export type Recording = { revision: string; label: string; variant: SurvivorVariant; skin: boolean; scenario: Scenario; fps: number; frames: Frame[] };
const out = process.argv[2] ?? 'test-results/player-anim/before';
const label = process.argv[3] ?? 'before';
const only = process.argv[4];
mkdirSync(out, { recursive: true });
const originalLoad = GLTFLoader.prototype.loadAsync;
GLTFLoader.prototype.loadAsync = async path => {
  const b = readFileSync(`public${path}`);
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
};
const material = () => Object.assign(new MeshLambertMaterial({ vertexColors: true }), { bloodCoverage: { value: 0 } });
const materials = { fromVertexColors: material, fromColor: material, get: material, unique: material } as unknown as Materials;
const pack = (node: Object3D) => [...node.position.toArray(), ...node.quaternion.toArray()];
const point = (node: Object3D) => node.getWorldPosition(new Vector3());
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
try {
  for (const variant of ['female', 'male'] as const) for (const scenario of scenarios) {
    if (only && only !== scenario) continue;
    const character = new CharacterView(); await character.init(materials, false, false, 'courier', label !== 'rigid');
    const c = (character as unknown as { characters: Map<string, { model: Group; rig: CharacterRig; animator: KeyframeAnimator }> }).characters.get(variant)!;
    const r = c.rig;
    const pose: SurvivorState = { variant, gearTier: 0, animation: 'idle', animationTick: 0, velocity: { x: 0, z: 0 }, grounded: true, invulnerableUntil: 0, checkpoint: { x: 0, y: .7, z: 0 }, diedAt: null };
    const bike = (await new GLTFLoader().loadAsync('/assets/models/veh.courier-bike.glb')).scene; bike.scale.setScalar(.6);
    const contacts = new RiderContacts(), travel = new Vector3();
    const frames: Frame[] = []; let speed = 0, pedal = 0;
    const duration = scenario === 'unarmed' ? 420 : scenario === 'bike' ? 420 : 300;
    for (let tick = 1; tick <= duration; tick++) {
      const t = tick / 60;
      let targetSpeed = scenario === 'walk' || scenario.startsWith('turn') ? 2 : scenario === 'run' ? 4.5 : 0;
      if (scenario === 'start-stop') targetSpeed = t < .5 || t >= 3 ? 0 : t < 1.6 ? 2 : 4.5;
      if (scenario === 'bike') targetSpeed = t >= 1.5 && t < 4.5 ? 4.5 : 0;
      if (t < .5) targetSpeed = 0;
      speed += Math.sign(targetSpeed - speed) * Math.min(Math.abs(targetSpeed - speed), (targetSpeed > speed ? 36 : 54) / 60);
      const yaw = scenario.startsWith('turn') && t >= 2.5 ? scenario === 'turn90' ? Math.PI / 2 : Math.PI : 0;
      travel.x += Math.cos(yaw) * speed / 60; travel.z -= Math.sin(yaw) * speed / 60;
      character.position.copy(travel); character.face(yaw, t);
      pose.velocity = { x: Math.cos(yaw) * speed, z: -Math.sin(yaw) * speed }; pose.animation = 'idle'; delete pose.attack;
      if (scenario === 'unarmed' || scenario === 'bat') {
        const actionId = scenario === 'unarmed' ? 'weapon.fists' : 'weapon.bat', moves = meleeMoves[actionId];
        let start = 31;
        for (let i = 0; i < moves.length * 2; i++) {
          const m = moves[i % moves.length], end = start + m.windup + m.active + m.recovery;
          if (tick >= start && tick < end) {
            pose.animation = 'swing'; pose.animationTick = start;
            pose.attack = { actionId, combo: i % moves.length, started: start, activeAt: start + m.windup, recoveryAt: start + m.windup + m.active, endsAt: end }; break;
          }
          start = end;
        }
      }
      if (scenario === 'hurt' && (tick >= 60 && tick < 78 || tick >= 120 && tick < 138)) { pose.animation = 'hurt'; pose.animationTick = tick < 100 ? 60 : 120; }
      const riding = scenario === 'bike' && t >= .75 && t < 5.5, steer = riding && speed ? Math.sin(t * 2) * .3 : 0;
      pedal += speed / 60 * 2;
      bike.position.copy(travel).add(new Vector3(0, 0, .3)); bike.rotation.set(0, yaw, 0);
      bike.getObjectByName('crank')!.rotation.z = -pedal; bike.getObjectByName('handlebar')!.rotation.y = steer;
      bike.updateMatrixWorld(true); bike.getWorldQuaternion(contacts.orientation);
      for (const [a, b] of [['seat', 'seat'], ['handL', 'grip_l'], ['handR', 'grip_r'], ['footL', 'pedal_l'], ['footR', 'pedal_r']] as const) bike.getObjectByName(b)!.getWorldPosition(contacts[a]);
      const started = performance.now();
      character.update(pose, tick, 1, riding ? { pedal, steer } : undefined);
      if (character.skinActive) character.applyRideContacts(riding ? contacts : undefined);
      else if (riding) { character.seatPelvis(contacts.seat, -.04); character.holdHandlebar(contacts.handL, contacts.handR); }
      character.updateMatrixWorld(true);
      const cpuMs = performance.now() - started;
      const knees: number[] = [], hips: number[][] = [], ankles: number[][] = [];
      for (const side of ['L', 'R'] as const) {
        const hip = point(r[`leg${side}`]), knee = point(r[`shin${side}`]), foot = point(r[`foot${side}`]);
        hips.push(hip.toArray()); ankles.push(foot.toArray()); knees.push(knee.clone().sub(hip).angleTo(foot.clone().sub(knee)) * 180 / Math.PI);
      }
      const phase = (c.animator as unknown as { phase: number }).phase;
      frames.push({ tick, actor: pack(character), joints: Object.fromEntries(characterNodes.map(n => [n, pack(r[n])])), bike: scenario === 'bike' ? pack(bike) : null,
        pedal, steer, clip: c.animator.clip, speed, phase, knees, hips, ankles, pelvis: point(r.hip).toArray(), cpuMs });
    }
    const data: Recording = { revision, label, variant, skin: character.skinActive, scenario, fps: 60, frames };
    writeFileSync(`${out}/${variant}-${scenario}.json`, JSON.stringify(data));
    const steady = frames.filter(f => f.tick > 90 && f.tick < 145);
    console.log(variant, scenario, 'skin', data.skin, 'knee max', Math.max(...steady.flatMap(f => f.knees)).toFixed(2));
    character.dispose();
  }
} finally { GLTFLoader.prototype.loadAsync = originalLoad; }

