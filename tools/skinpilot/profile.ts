import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { cpus, platform } from 'node:os';
import { performance } from 'node:perf_hooks';
import { MeshLambertMaterial, SkinnedMesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { CharacterView } from '../../src/render/characters/CharacterView';
import { RiderContacts } from '../../src/render/characters/RiderContacts';
import type { SurvivorState } from '../../src/data/survivor';
import type { Materials } from '../../src/render/Materials';

/** Desktop CPU isolation: real GLBs/mixer/IK, matrices and skeleton palette;
 * 300 warm-up + 2,000 measured frames per pose, no renderer or sim. Browser
 * A/B captures supply renderer draw counts and browser CPU measurements. */
const out = process.argv[2] ?? 'test-results/skin-pilot'; mkdirSync(out, { recursive: true });
const originalLoad = GLTFLoader.prototype.loadAsync;
const load = async (path: string) => {
  const bytes = readFileSync(path);
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
};
GLTFLoader.prototype.loadAsync = async path => load(`public${path}`);
const makeMaterial = () => Object.assign(new MeshLambertMaterial({ vertexColors: true }), { bloodCoverage: { value: 0 } });
const materials = { fromVertexColors: makeMaterial, fromColor: makeMaterial, get: makeMaterial, unique: makeMaterial } as unknown as Materials;
const percentile = (values: number[], p: number) => values.sort((a, b) => a - b)[Math.floor((values.length - 1) * p)];
const results: Record<string, unknown> = {};
try {
  for (const skin of [false, true]) for (const mode of ['idle', 'walk', 'run', 'jab', 'kick', 'bat', 'ride']) {
    const character = new CharacterView(); await character.init(materials, false, false, 'courier', skin);
    const pose: SurvivorState = { variant: 'female', gearTier: 0, animation: 'idle', animationTick: 0, velocity: { x: 0, z: 0 }, grounded: true, invulnerableUntil: 0, checkpoint: { x: 0, y: .7, z: 0 }, diedAt: null };
    const contacts = new RiderContacts(), bike = (await load('public/assets/models/veh.courier-bike.glb')).scene;
    bike.scale.setScalar(.6);
    const meshes: SkinnedMesh[] = []; character.traverse(node => { if (node instanceof SkinnedMesh) meshes.push(node); });
    const samples: number[] = [], matrixSamples: number[] = [];
    const speed = mode === 'walk' ? 2 : mode === 'run' ? 4.5 : 0;
    for (let tick = 1; tick <= 2300; tick++) {
      const x = tick * speed / 60, pedal = tick * .1;
      character.position.set(x, 0, 0); character.quaternion.identity();
      pose.velocity.x = speed;
      if (['jab', 'bat', 'kick'].includes(mode)) {
        pose.animation = mode === 'kick' ? 'kick' : 'swing'; pose.animationTick = tick - tick % 36;
        pose.attack = { actionId: mode === 'kick' ? 'weapon.kick' : mode === 'bat' ? 'weapon.bat' : 'weapon.fists', combo: 0, started: pose.animationTick, activeAt: pose.animationTick + 8, recoveryAt: pose.animationTick + 12, endsAt: pose.animationTick + 36 };
      }
      if (mode === 'ride') {
        bike.getObjectByName('crank')!.rotation.z = -pedal; bike.updateMatrixWorld(true);
        for (const [target, name] of [['seat', 'seat'], ['handL', 'grip_l'], ['handR', 'grip_r'], ['footL', 'pedal_l'], ['footR', 'pedal_r']] as const) bike.getObjectByName(name)!.getWorldPosition(contacts[target]);
      }
      const start = performance.now();
      character.update(pose, tick, 1, mode === 'ride' ? { pedal, steer: 0 } : undefined);
      if (skin) character.applyRideContacts(mode === 'ride' ? contacts : undefined);
      else if (mode === 'ride') { character.seatPelvis(contacts.seat, -.04); character.holdHandlebar(contacts.handL, contacts.handR); }
      const matrices = performance.now(); character.updateMatrixWorld(true); for (const mesh of meshes) mesh.skeleton.update();
      const end = performance.now();
      if (tick > 300) { samples.push(end - start); matrixSamples.push(end - matrices); }
    }
    results[`skin${Number(skin)}-${mode}`] = { frames: samples.length, cpuMsP50: percentile(samples, .5), cpuMsP95: percentile(samples, .95), cpuMsMean: samples.reduce((a, b) => a + b, 0) / samples.length,
      matrixAndSkeletonMsP95: percentile(matrixSamples, .95), skinnedMeshes: meshes.length, bones: meshes[0]?.skeleton.bones.length ?? 0 };
    character.dispose(); console.log(`profiled skin${Number(skin)} ${mode}`);
  }
} finally { GLTFLoader.prototype.loadAsync = originalLoad; }
writeFileSync(`${out}/cpu-profile.json`, JSON.stringify({ platform: platform(), cpu: cpus()[0]?.model, node: process.version, method: '300 warm-up, 2000 timed frames; CharacterView.update + ride contacts + matrix propagation + Skeleton.update; no simulation/render', results }, null, 2) + '\n');
