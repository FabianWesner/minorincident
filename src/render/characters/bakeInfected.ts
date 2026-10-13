// Runtime adaptation of E17 bake-crowd.ts and Bruno InstancedGroup.js (MIT).
import { AnimationMixer, LoopOnce, BufferAttribute, DoubleSide, InterleavedBuffer, InterleavedBufferAttribute, Matrix4, Mesh, Vector3, type Group, type Object3D, type MeshBasicMaterial } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { characterNodes } from '../../data/survivor';
import { authoredClips, sampleClip, strideScale } from './clips';
import type { CharacterRig } from './rig';
import type { CrowdClip } from '../../assets/crowd';
type BakedCrowd = { geometry: import('three').BufferGeometry; clip: CrowdClip; shirtColor: import('three').Color | undefined; doubleSided: boolean; strideScale: number };
// Only immutable CPU data lives here. Scenes own separate geometry; the cache owns no GPU resources.
const bakedCrowds = new Map<string, BakedCrowd>();
const bakedCrowdLimit = 64;
export const infectedClips = ['idle', 'run', 'swing', 'hurt', 'die', 'crawl', 'windup', 'walk', 'shamble', 'infected-run', 'npc-walk', 'npc-walk-relaxed', 'stagger-left', 'stagger-right', 'knockdown', 'get-up', 'flung', 'death-back', 'death-side', 'death-crumple', 'infection-stagger', 'infection-collapse', 'infection-rise',
  'infected-frail', 'infected-lurch', 'infected-sprint', 'infected-idle', 'infected-search', 'civ-startle', 'civ-flee', 'civ-grabbed', 'zebra-rear-kick', 'zebra-stampede', 'dog-gallop', 'dog-lunge-bite'] as const;
export const civilianClips = [...infectedClips.filter(clip => !clip.startsWith('zebra-') && !clip.startsWith('dog-')), 'npc-sit', 'npc-sit-down', 'npc-stand-up', 'npc-gesture', 'npc-look-around', 'npc-water', 'npc-carry', 'npc-cane',
  'npc-give', 'npc-wave', 'npc-glance', 'npc-sign', 'npc-wave-in', 'npc-bang', 'npc-plead', 'npc-press', 'npc-cower', 'npc-hug', 'ff-pry', 'npc-stand-back', 'shoot'] as const;
export const framesPerClip = 24;
/** Clips whose feet legitimately leave the floor plane (seated, knocked down, rising, dying): Scene Lab's rule. */
const unplantedClips = /death|die|knockdown|flung|get-up|crawl|collapse|rise|sit|stand-up|grabbed|bitten|down/;
const sole = new Vector3();
/** Bake once at level load: merged color geometry, part indices and the shared authored glTF rigid-part actions. */
export function bakeInfected(root: Group, animatedNodes: readonly string[] = [], crawlingRestPose = false, clipNames: readonly string[] = infectedClips, cacheKey?: string): BakedCrowd {
  const rig = {} as CharacterRig;
  for (const name of characterNodes) {
    let node = root.getObjectByName(name);
    if (!node) { node = root.clone(false); node.name = name; node.position.set(0, 0, 0); root.add(node); }
    rig[name] = node;
  }
  const parts: Object3D[] = characterNodes.map((name) => rig[name]);
  for (const name of animatedNodes) { const node = root.getObjectByName(name); if (node && !parts.includes(node)) parts.push(node); }
  // Pose frames need joint matrices, not every rigid mesh's world matrix.
  // Include each joint's ancestors in tree order; source meshes get a full
  // update once after the rest pose is restored, before geometry extraction.
  const required = new Set<Object3D>();
  for (const part of parts) for (let node: Object3D | null = part; node; node = node.parent) { required.add(node); if (node === root) break; }
  const joints: Object3D[] = []; root.traverse(node => { if (required.has(node)) joints.push(node); });
  const updateJoints = () => {
    for (const node of joints) {
      if (node.matrixAutoUpdate) node.updateMatrix();
      if (node.matrixWorldAutoUpdate) { if (node.parent) node.matrixWorld.multiplyMatrices(node.parent.matrixWorld, node.matrix); else node.matrixWorld.copy(node.matrix); }
      node.matrixWorldNeedsUpdate = false;
    }
  };
  const key = cacheKey ? `${cacheKey}:${crawlingRestPose}:${animatedNodes.join(',')}:${clipNames.join(',')}` : undefined;
  const cached = key && bakedCrowds.get(key);
  if (cached) {
    bakedCrowds.delete(key!); bakedCrowds.set(key!, cached); root.updateMatrixWorld(true);
    return { ...cached, geometry: cached.geometry.clone(), shirtColor: cached.shirtColor?.clone() };
  }
  const rest = parts.map((part) => ({ position: part.position.clone(), rotation: part.rotation.clone() }));
  const matrices = new Float32Array(clipNames.length * framesPerClip * parts.length * 16);
  let matrixOffset = 0;
  // Standing and gait frames keep both soles on the floor (QA: infected feet 2-6 cm under the floor in the hunched
  // idle and lurch): retargeted onto shorter or differently proportioned rigs, the authored crouch can put a heel or toe
  // under the ground. Same heel/toe points as the footwork solver and CrowdFigureProbe; the pelvis rises by the deficit.
  const feet = [rig.footL, rig.footR], soleHeight = (root.updateMatrixWorld(true), rig.footL.getWorldPosition(sole).y / rig.hip.parent!.getWorldScale(sole).y);
  const lowestSole = () => Math.min(...feet.flatMap(foot => [-.05, .085].map(x => sole.set(x, -soleHeight, 0).applyMatrix4(foot.matrixWorld).y)));
  const floor = lowestSole(), animalRig = !!root.getObjectByName('body'), flying = !!root.getObjectByName('wingL');
  // Zebra's long multi-part legs retain authored joint offsets. Ground all four real
  // hoof bounds together instead of moving a whole upper leg away from its shoulder.
  const preserveAnimalJoints = root.getObjectByName('root')?.userData.ss_preserveAnimalJoints === true;
  const hoofPoints = preserveAnimalJoints ? ['pawFL', 'pawFR', 'pawBL', 'pawBR'].flatMap(name => {
    const paw = root.getObjectByName(name); if (!paw) return [];
    const points: { paw: Object3D; point: Vector3 }[] = [];
    paw.traverse(node => {
      if (!(node instanceof Mesh)) return;
      const position = node.geometry.getAttribute('position');
      for (let i = 0; i < position.count; i++) points.push({ paw, point: paw.worldToLocal(new Vector3().fromBufferAttribute(position, i).applyMatrix4(node.matrixWorld)) });
    });
    return points;
  }) : [];
  const lowestHoof = () => {
    let bottom = Infinity;
    for (const { paw, point } of hoofPoints) bottom = Math.min(bottom, sole.copy(point).applyMatrix4(paw.matrixWorld).y);
    return bottom;
  };
  const hoofFloor = hoofPoints.length ? lowestHoof() : 0;

  const mixer = new AnimationMixer(root);
  for (const clip of clipNames) {
    const embedded = root.animations.find(animation => animation.name === clip);
    const action = embedded ? mixer.clipAction(embedded).setLoop(LoopOnce, 1) : undefined;
    if (action) { action.clampWhenFinished = true; action.reset().play(); }
    const name = animalRig ? /^(die|death-|flung|knockdown)/.test(clip) ? 'animal-death' : /^(idle|infected-idle|infected-search|civ-startle|civ-grabbed)$/.test(clip) ? 'corgi-idle' : /^(windup|swing|zebra-rear-kick|zebra-stampede)$/.test(clip) ? 'corgi-idle' : flying ? 'infected-flight' : 'corgi-trot' : clip.startsWith('zebra-') || clip.startsWith('dog-') ? 'idle' : crawlingRestPose && clip === 'crawl' ? 'infected-run' : clip;
    const duration = embedded?.duration ?? authoredClips.get(name)!.duration, planted = (!animalRig || root.getObjectByName('root')?.userData.groundedAnimal === true) && soleHeight > 0 && !unplantedClips.test(clip);
    for (let frame = 0; frame < framesPerClip; frame++) {
      for (let i = 0; i < parts.length; i++) { parts[i].position.copy(rest[i].position); parts[i].rotation.copy(rest[i].rotation); }
      const t = frame / (framesPerClip - 1);
      if (action) mixer.setTime(t * duration); else sampleClip(root, name, t * duration);
      updateJoints();
      if (hoofPoints.length && !unplantedClips.test(clip)) {
        const deficit = hoofFloor - lowestHoof();
        if (deficit > 1e-4) { rig.hip.position.y += deficit / rig.hip.parent!.getWorldScale(sole).y; updateJoints(); }
      }
      if (planted) {
        const deficit = floor - lowestSole();
        if (deficit > 1e-4) { rig.hip.position.y += deficit / rig.hip.parent!.getWorldScale(sole).y; updateJoints(); }
      }
      for (const part of parts) { part.matrixWorld.toArray(matrices, matrixOffset); matrixOffset += 16; }
    }
    action?.stop();
  }
  mixer.uncacheRoot(root);
  for (let i = 0; i < parts.length; i++) { parts[i].position.copy(rest[i].position); parts[i].rotation.copy(rest[i].rotation); }
  root.updateMatrixWorld(true);
  const geometries: import('three').BufferGeometry[] = [], relative = new Matrix4();
  let shirtColor: import('three').Color | undefined;
  let doubleSided = false;
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
    doubleSided ||= material.side === DoubleSide;
    const count = geometry.getAttribute('position').count, colors = new Float32Array(count * 3), emissive = new Float32Array(count), indices = new Float32Array(count), shirt = new Float32Array(count);
    const clothing = material.name === 'pal_infectedShirt'; if (clothing) shirtColor = material.color.clone();
    const sourceColor = geometry.getAttribute('color');
    const base = material.color?.toArray() ?? [0.4, 0.3, 0.25];
    for (let i = 0; i < count; i++) {
      colors[i * 3] = base[0] * (material.vertexColors && sourceColor ? sourceColor.getX(i) : 1);
      colors[i * 3 + 1] = base[1] * (material.vertexColors && sourceColor ? sourceColor.getY(i) : 1);
      colors[i * 3 + 2] = base[2] * (material.vertexColors && sourceColor ? sourceColor.getZ(i) : 1);
      // uiDark also owns hair, brows and collars: height cannot identify pupils.
      const pupil = owner === rig.head && /^(pal_)?eyeBrown$/.test(material.name) && geometry.getAttribute('position').getY(i) > .08;
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
  const baked = { geometry, clip, shirtColor, doubleSided, strideScale: strideScale(root) };
  if (key) {
    bakedCrowds.set(key, { ...baked, geometry: geometry.clone(), shirtColor: shirtColor?.clone() });
    if (bakedCrowds.size > bakedCrowdLimit) {
      const oldest = bakedCrowds.keys().next().value!;
      bakedCrowds.get(oldest)!.geometry.dispose(); bakedCrowds.delete(oldest);
    }
  }
  return baked;
}
