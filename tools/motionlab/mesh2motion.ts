/** Offline adapter to a pinned Mesh2Motion checkout. Run with tsx, no renderer. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AnimationMixer, Box3, BufferAttribute, Group, Matrix4, Mesh, Skeleton, SkinnedMesh, Vector3, type Bone, type AnimationClip } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshStandardMaterial } from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

const checkout = process.env.MESH2MOTION_SOURCE ?? '/private/tmp/motion-lib-mesh2motion';
const sourceCommit = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (sourceCommit !== '79f3f61a9852ef70234a5a4a7c13ed87f7a71833') throw new Error('Mesh2Motion checkout must match the documented pinned commit');
const output = resolve('public/assets/motionlab/survivor-mesh2motion.glb');
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
async function load(path: string) {
  const file = await readFile(path), jsonSize = file.readUInt32LE(12), json = JSON.parse(file.subarray(20, 20 + jsonSize).toString());
  // Animation source GLBs include preview textures; a Node rig build needs no images.
  for (const material of json.materials ?? []) { delete material.normalTexture; delete material.occlusionTexture; delete material.emissiveTexture; if (material.pbrMetallicRoughness) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.pbrMetallicRoughness.metallicRoughnessTexture; } }
  const text = Buffer.from(JSON.stringify(json)), padded = Math.ceil(text.length / 4) * 4, tail = file.subarray(20 + jsonSize), glb = Buffer.alloc(20 + padded + tail.length, 32);
  file.copy(glb, 0, 0, 12); glb.writeUInt32LE(glb.length, 8); glb.writeUInt32LE(padded, 12); glb.writeUInt32LE(0x4e4f534a,16); text.copy(glb,20); tail.copy(glb,20+padded);
  return loader.parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '');
}
const source = await load('public/assets/models/char.survivor-female.lod1.glb');
const template = await load(`${checkout}/static/rigs/rig-human.glb`);
const animations = await load(`${checkout}/static/animations/human-base-animations.glb`);
source.scene.rotation.y = -Math.PI / 2; source.scene.updateMatrixWorld(true); template.scene.updateMatrixWorld(true);
const bones: Bone[] = []; template.scene.traverse(n => { if (n.type === 'Bone') bones.push(n as Bone); });
if (process.argv.includes('--inspect')) {
  console.log(JSON.stringify({ source: Object.fromEntries(['hip','torso','head','armL','foreArmL','handL','legL','shinL','footL'].map(n=>[n,source.scene.getObjectByName(n)?.getWorldPosition(new Vector3()).toArray()])), bones: bones.map(b=>({name:b.name,position:b.getWorldPosition(new Vector3()).toArray()})), clips:animations.animations.map(a=>a.name) })); process.exit(0);
}
// The tool's editor requires landmarks. Use our known joint nodes as the repeatable
// equivalent of manual placement. Preserve each template bone's rest orientation.
const mapping: Record<string, string> = { pelvis:'hip', spine:'torso', spine_01:'torso', spine_02:'torso', spine_03:'torso', neck_01:'head', head:'head', upperarm_l:'armL', upperarm_r:'armR', lowerarm_l:'foreArmL', lowerarm_r:'foreArmR', hand_l:'handL', hand_r:'handR', thigh_l:'legL', thigh_r:'legR', calf_l:'shinL', calf_r:'shinR', foot_l:'footL', foot_r:'footR' };
const originalWorld = new Map(bones.map(b=>[b,b.getWorldPosition(new Vector3())]));
const root = bones[0];
const height = new Box3().setFromObject(source.scene).getSize(new Vector3()).y;
const scale = height / 1.8;
for (const bone of bones) {
  const targetName = mapping[bone.name], target = targetName ? source.scene.getObjectByName(targetName) : undefined;
  const desired = target ? target.getWorldPosition(new Vector3()) : originalWorld.get(bone)!.clone().multiplyScalar(scale);
  if (bone.parent) bone.position.copy(bone.parent.worldToLocal(desired)); else bone.position.copy(desired);
  template.scene.updateMatrixWorld(true);
}
const module = await import(pathToFileURL(`${checkout}/src/lib/solvers/SkinningAlgorithm.ts`).href);
const solver = new module.default(root, 'human');
solver.set_head_weight_correction_enabled(true); solver.set_preview_plane_height(source.scene.getObjectByName('head')!.getWorldPosition(new Vector3()).y - .1);
solver.set_arm_plane_correction_enabled(true);
const skeleton = new Skeleton(bones), result = new Group(); result.attach(root); result.updateMatrixWorld(true); skeleton.calculateInverses();
let vertices = 0, weighted = 0;
const pieces: import('three').BufferGeometry[] = [];
source.scene.traverse(node => {
  if (!(node instanceof Mesh)) return;
  for (let p: import('three').Object3D | null = node; p; p=p.parent) if (!p.visible || p.name.startsWith('stump_')) return;
  const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
  for (const name of ['position','normal']) { const a=geometry.getAttribute(name), values=new Float32Array(a.count*3); for(let i=0;i<a.count;i++)for(let c=0;c<3;c++)values[i*3+c]=a.getComponent(i,c); geometry.setAttribute(name,new BufferAttribute(values,3)); }
  geometry.applyMatrix4(node.matrixWorld);
  const material = (Array.isArray(node.material) ? node.material[0] : node.material) as MeshStandardMaterial;
  const old = geometry.getAttribute('color'), colors = new Float32Array(geometry.getAttribute('position').count * 3);
  for(let i=0;i<colors.length / 3;i++)for(let c=0;c<3;c++)colors[i*3+c]=material.color.toArray()[c]*(material.vertexColors && old ? old.getComponent(i,c) : 1);
  for(const name of Object.keys(geometry.attributes))if(!['position','normal'].includes(name))geometry.deleteAttribute(name);
  geometry.setAttribute('color',new BufferAttribute(colors,3)); geometry.clearGroups(); pieces.push(geometry);
});
const geometry = mergeVertices(mergeGeometries(pieces)!, 1e-5); for(const piece of pieces)piece.dispose(); solver.set_geometry(geometry);
const [indices,weights] = solver.calculate_indexes_and_weights();
geometry.setAttribute('skinIndex',new BufferAttribute(new Uint16Array(indices),4)); geometry.setAttribute('skinWeight',new BufferAttribute(new Float32Array(weights),4));
vertices=geometry.getAttribute('position').count; weighted=weights.filter((w:number)=>w>0&&w<1).length;
const mesh = new SkinnedMesh(geometry,new MeshStandardMaterial({vertexColors:true,roughness:1})); mesh.name='mesh2motion-survivor'; result.add(mesh); mesh.bind(skeleton,new Matrix4());
// In-place library clips: strip pelvis/root translation. Root remains sim-owned.
const selected = animations.animations.filter(a => /^(Idle_A|Walk|Jog|Sprint|Zombie_Walk)$/i.test(a.name));
const clips: AnimationClip[] = selected.map(a=>{const clip=a.clone();clip.tracks=clip.tracks.filter(t=>!t.name.endsWith('.position') && !t.name.startsWith('root.'));return clip;});
if(!clips.length) throw new Error('No locomotion clips matched; inspect library names.');
class BlobReader { result: ArrayBuffer | null = null; onloadend?:()=>void; readAsArrayBuffer(blob:Blob) { void blob.arrayBuffer().then(data=>{this.result=data;this.onloadend?.();}); } }
Object.assign(globalThis,{FileReader:BlobReader});
result.rotation.y = Math.PI / 2; result.updateMatrixWorld(true);
const binary=await new GLTFExporter().parseAsync(result,{binary:true,animations:clips});
await mkdir(resolve('public/assets/motionlab'),{recursive:true}); await writeFile(output,new Uint8Array(binary as ArrayBuffer));
const parsed=await load(output), cloned=clone(parsed.scene), mixer=new AnimationMixer(cloned); mixer.clipAction(parsed.animations[0]).play(); mixer.update(.5);
await writeFile(resolve('public/assets/motionlab/provenance.json'), JSON.stringify({ sourceCommit, animations: 'static/animations/human-base-animations.glb', rig: 'static/rigs/rig-human.glb', sourceModel: 'char.survivor-female.lod1.glb', license: 'CC0-1.0', sha256: createHash('sha256').update(new Uint8Array(binary as ArrayBuffer)).digest('hex'), bones: bones.length, vertices, fractionalInfluences: weighted, clips: clips.map(c=>c.name) }, null, 2) + '\n');
console.log(JSON.stringify({output,vertices,weightedInfluences:weighted,bones:bones.length,clips:clips.map(a=>a.name),bytes:(binary as ArrayBuffer).byteLength,cloneMixerCompatible:true}));
