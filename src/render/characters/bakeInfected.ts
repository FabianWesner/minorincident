// Runtime adaptation of E17 bake-crowd.ts and Bruno InstancedGroup.js (MIT).
import { BufferAttribute, InterleavedBuffer, InterleavedBufferAttribute, Matrix4, Mesh, type Group, type Object3D, type MeshBasicMaterial } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { characterNodes } from '../../data/survivor';
import { authoredClips, sampleClip, strideScale } from './clips';
import type { CharacterRig } from './rig';
import type { CrowdClip } from '../../assets/crowd';
export const infectedClips = ['idle', 'run', 'swing', 'hurt', 'die', 'crawl', 'windup', 'walk', 'shamble', 'infected-run', 'npc-walk', 'npc-walk-relaxed', 'stagger-left', 'stagger-right', 'knockdown', 'get-up', 'flung', 'death-back', 'death-side', 'death-crumple', 'infection-stagger', 'infection-collapse', 'infection-rise'] as const;
export const civilianClips = ['idle', 'run', 'hurt', 'death-side', 'npc-walk', 'npc-walk-relaxed', 'infection-stagger', 'infection-collapse', 'infection-rise', 'npc-sit', 'npc-sit-down', 'npc-stand-up', 'npc-gesture', 'npc-look-around', 'npc-water', 'npc-carry', 'npc-cane'] as const;
export const framesPerClip = 24;
/** Bake once at level load: merged color geometry, part indices and the shared authored glTF rigid-part actions. */
export function bakeInfected(root: Group, animatedNodes: readonly string[] = [], crawlingRestPose = false, clipNames: readonly string[] = infectedClips) {
  const rig = {} as CharacterRig;
  for (const name of characterNodes) {
    let node = root.getObjectByName(name);
    if (!node) { node = root.clone(false); node.name = name; node.position.set(0, 0, 0); root.add(node); }
    rig[name] = node;
  }
  const parts: Object3D[] = characterNodes.map((name) => rig[name]);
  for (const name of animatedNodes) { const node = root.getObjectByName(name); if (node && !parts.includes(node)) parts.push(node); }
  const rest = parts.map((part) => ({ position: part.position.clone(), rotation: part.rotation.clone() }));
  const matrices = new Float32Array(clipNames.length * framesPerClip * parts.length * 16);
  let matrixOffset = 0;
  for (const clip of clipNames) for (let frame = 0; frame < framesPerClip; frame++) {
    for (let i = 0; i < parts.length; i++) { parts[i].position.copy(rest[i].position); parts[i].rotation.copy(rest[i].rotation); }
    const t = frame / (framesPerClip - 1);
    const animal = !!root.getObjectByName('body');
    const name = animal ? /^(die|death-|flung|knockdown)/.test(clip) ? 'animal-death' : clip === 'idle' ? 'corgi-idle' : root.getObjectByName('wingL') ? 'infected-flight' : 'corgi-trot' : crawlingRestPose && clip === 'crawl' ? 'infected-run' : clip;
    sampleClip(root, name, t * authoredClips.get(name)!.duration);
    root.updateMatrixWorld(true); for (const part of parts) { part.matrixWorld.toArray(matrices, matrixOffset); matrixOffset += 16; }
  }
  for (let i = 0; i < parts.length; i++) { parts[i].position.copy(rest[i].position); parts[i].rotation.copy(rest[i].rotation); }
  root.updateMatrixWorld(true);
  const geometries: import('three').BufferGeometry[] = [], relative = new Matrix4();
  let shirtColor: import('three').Color | undefined;
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    for (let ancestor: Object3D | null = node; ancestor; ancestor = ancestor.parent) if (!ancestor.visible || ancestor.name.startsWith('stump_')) return;
    // A named animated part can itself be a Mesh (not only a parent joint).
    let owner: Object3D | null = node;
    while (owner && !parts.includes(owner)) owner = owner.parent;
    const part = parts.indexOf(owner ?? rig.root);
    relative.copy(parts[part].matrixWorld).invert().multiply(node.matrixWorld);
    const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
    // Meshopt GLBs may use normalized integer attributes; transforms must write floats.
    for (const name of ['position', 'normal']) {
      const attribute = geometry.getAttribute(name);
      if (attribute.array instanceof Float32Array && !attribute.normalized) continue;
      const values = new Float32Array(attribute.count * attribute.itemSize);
      for (let i = 0; i < attribute.count; i++) for (let c = 0; c < attribute.itemSize; c++) values[i * attribute.itemSize + c] = attribute.getComponent(i, c);
      geometry.setAttribute(name, new BufferAttribute(values, attribute.itemSize));
    }
    geometry.applyMatrix4(relative);
    // Every source material is folded into vertex colors, yielding one draw per role.
    const material = (Array.isArray(node.material) ? node.material[0] : node.material) as MeshBasicMaterial;
    const count = geometry.getAttribute('position').count, colors = new Float32Array(count * 3), emissive = new Float32Array(count), indices = new Float32Array(count), shirt = new Float32Array(count);
    const clothing = material.name === 'pal_infectedShirt'; if (clothing) shirtColor = material.color.clone();
    const sourceColor = geometry.getAttribute('color');
    for (let i = 0; i < count; i++) {
      const color = material.color?.toArray() ?? [0.4, 0.3, 0.25];
      if (material.vertexColors && sourceColor) { color[0] *= sourceColor.getX(i); color[1] *= sourceColor.getY(i); color[2] *= sourceColor.getZ(i); }
      colors.set(color, i * 3); // Civilian GLBs use dark pupils rather than emissive eye materials.
      const pupil = owner === rig.head && /^(pal_)?(eyeBrown|uiDark)$/.test(material.name) && geometry.getAttribute('position').getY(i) > .08;
      emissive[i] = Number(material.name.startsWith('emi_') || pupil); indices[i] = part; shirt[i] = /^(pal_)?skin/.test(material.name) ? -1 : Number(clothing);
    }
    geometry.setAttribute('_shirt', new BufferAttribute(shirt, 1)); geometry.setAttribute('color', new BufferAttribute(colors, 3)); geometry.setAttribute('_emissive', new BufferAttribute(emissive, 1)); geometry.setAttribute('_part_index', new BufferAttribute(indices, 1)); geometry.deleteAttribute('uv');
    geometries.push(geometry);
  });
  const geometry = mergeGeometries(geometries); if (!geometry) throw new Error('Infected geometry merge failed'); for (const source of geometries) source.dispose();
  // WebGPU guarantees eight vertex buffers. Six static attributes share one buffer,
  // leaving room for the instance matrix, tint, clip frame and limb mask (five total).
  const names = ['position', 'normal', 'color', '_shirt', '_emissive', '_part_index'];
  const attributes = names.map((name) => geometry.getAttribute(name));
  const stride = attributes.reduce((sum, attribute) => sum + attribute.itemSize, 0);
  const data = new InterleavedBuffer(new Float32Array(attributes[0].count * stride), stride);
  let offset = 0;
  for (let a = 0; a < attributes.length; a++) {
    const attribute = attributes[a];
    for (let i = 0; i < attribute.count; i++) for (let c = 0; c < attribute.itemSize; c++) data.array[i * stride + offset + c] = attribute.getComponent(i, c);
    geometry.setAttribute(names[a], new InterleavedBufferAttribute(data, attribute.itemSize, offset));
    offset += attribute.itemSize;
  }
  const clip: CrowdClip = { parts: parts.map(part => part.name), frames: framesPerClip * clipNames.length, duration: clipNames.length, matrices };
  return { geometry, clip, shirtColor, strideScale: strideScale(root) };
}
