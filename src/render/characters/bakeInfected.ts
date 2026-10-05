// Runtime adaptation of E17 bake-crowd.ts and Bruno InstancedGroup.js (MIT).
import { BufferAttribute, Matrix4, Mesh, type Group, type Object3D, type MeshBasicMaterial } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { characterNodes, type AnimationState } from '../../data/survivor';
import { clips } from './clips';
import type { CharacterRig } from './rig';
import type { CrowdClip } from '../../assets/crowd';
export const infectedClips = ['idle', 'run', 'swing', 'hurt', 'die', 'crawl', 'windup'] as const;
export const framesPerClip = 24;
/** Bake once at level load: merged color geometry, part indices and the shared procedural rigid-part clips. */
export function bakeInfected(root: Group) {
  const rig = {} as CharacterRig;
  for (const name of characterNodes) {
    let node = root.getObjectByName(name);
    if (!node) { node = root.clone(false); node.name = name; node.position.set(0, 0, 0); root.add(node); }
    rig[name] = node;
  }
  const parts: Object3D[] = characterNodes.map((name) => rig[name]);
  const rest = parts.map((part) => ({ position: part.position.clone(), rotation: part.rotation.clone() }));
  const matrices: number[] = [];
  for (const clip of infectedClips) for (let frame = 0; frame < framesPerClip; frame++) {
    for (let i = 0; i < parts.length; i++) { parts[i].position.copy(rest[i].position); parts[i].rotation.copy(rest[i].rotation); }
    const t = frame / (framesPerClip - 1);
    if (clip === 'crawl') { rig.hip.position.y = 0.28; rig.torso.rotation.z -= Math.PI / 2; clips.run(rig, t); }
    else if (clip === 'windup') { rig.torso.rotation.z += t * 0.45; rig.armL.rotation.z -= t * 0.8; rig.armR.rotation.z -= t * 0.8; }
    else clips[clip as AnimationState](rig, t);
    root.updateMatrixWorld(true); for (const part of parts) matrices.push(...part.matrixWorld.elements);
  }
  for (let i = 0; i < parts.length; i++) { parts[i].position.copy(rest[i].position); parts[i].rotation.copy(rest[i].rotation); }
  root.updateMatrixWorld(true);
  const geometries: import('three').BufferGeometry[] = [], relative = new Matrix4();
  root.traverse((node) => {
    if (!(node instanceof Mesh) || !node.visible || node.name.startsWith('stump_')) return;
    let owner: Object3D | null = node.parent;
    while (owner && !parts.includes(owner)) owner = owner.parent;
    const part = parts.indexOf(owner ?? rig.root);
    relative.copy(parts[part].matrixWorld).invert().multiply(node.matrixWorld);
    const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone(); geometry.applyMatrix4(relative);
    // Every source material is folded into vertex colors, yielding one draw per role.
    const material = (Array.isArray(node.material) ? node.material[0] : node.material) as MeshBasicMaterial;
    const count = geometry.getAttribute('position').count, colors = new Float32Array(count * 3), emissive = new Float32Array(count), indices = new Float32Array(count);
    for (let i = 0; i < count; i++) { colors.set(material.color?.toArray() ?? [0.4, 0.3, 0.25], i * 3); emissive[i] = Number(material.name.startsWith('emi_')); indices[i] = part; }
    geometry.setAttribute('color', new BufferAttribute(colors, 3)); geometry.setAttribute('_emissive', new BufferAttribute(emissive, 1)); geometry.setAttribute('_part_index', new BufferAttribute(indices, 1)); geometry.deleteAttribute('uv');
    geometries.push(geometry);
  });
  const geometry = mergeGeometries(geometries); if (!geometry) throw new Error('Infected geometry merge failed'); for (const source of geometries) source.dispose();
  const clip: CrowdClip = { parts: characterNodes.slice(), frames: framesPerClip * infectedClips.length, duration: infectedClips.length, matrices };
  return { geometry, clip };
}
