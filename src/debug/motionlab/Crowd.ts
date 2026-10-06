import { BufferAttribute, Group, InstancedBufferAttribute, InstancedInterleavedBuffer, InstancedMesh, Matrix4, MeshLambertNodeMaterial, SkinnedMesh, Vector3, type DataTexture } from 'three/webgpu';
import { attribute, cameraViewMatrix, instancedBufferAttribute, mat4, mix, normalGeometry, positionGeometry, vec4 } from 'three/tsl';
import { clipTexture, crowdMatrix } from '../../assets/crowd';
import { bakeInfected, framesPerClip, infectedClips } from '../../render/characters/bakeInfected';
import { authoredClips, sampleClip, strideScale, strides } from '../../render/characters/clips';
import { dt, type Motion } from './Motion';

const names = ['idle', 'walk', 'run', 'npc-walk', 'shamble', 'infected-run'] as const;
const samples = 24;
export class LabCrowd {
  readonly mesh: InstancedMesh;
  readonly texture: DataTexture;
  private readonly pose: InstancedBufferAttribute;
  private readonly transition: { clip: string; from: number; blend: number }[];
  private readonly scale: number;
  private readonly matrix = new Matrix4();
  private readonly clips: readonly string[];
  private readonly frames: number;
  readonly bytes: number;
  private readonly parts: string[];
  private readonly restPoints = new Map<string, Vector3>();
  constructor(model: Group, capacity: number, private readonly prototype: boolean, private readonly civilian = false) {
    let geometry: import('three').BufferGeometry;
    this.scale = strideScale(model);
    if (!prototype) {
      const baked = bakeInfected(model); geometry = baked.geometry; this.texture = clipTexture(baked.clip); this.clips = infectedClips; this.frames = framesPerClip; this.parts = baked.clip.parts;
    } else {
      const skin = model.getObjectByName('lab-skin') as SkinnedMesh, skeleton = skin.skeleton;
      this.parts = skeleton.bones.map(b => b.name);
      for (const bone of skeleton.bones) this.restPoints.set(bone.name, bone.getWorldPosition(new Vector3()));
      geometry = skin.geometry.clone(); const indices = geometry.getAttribute('skinIndex'), weights = geometry.getAttribute('skinWeight'), joints = new Float32Array(indices.count * 3);
      for (let i = 0; i < indices.count; i++) joints.set([indices.getX(i), indices.getY(i), weights.getY(i)], i * 3);
      geometry.deleteAttribute('skinIndex'); geometry.deleteAttribute('skinWeight'); geometry.setAttribute('_joints', new BufferAttribute(joints, 3));
      const matrices: number[] = [], matrix = new Matrix4();
      for (const name of names) for (let i = 0; i < samples; i++) {
        sampleClip(model, name, i / (samples - 1) * authoredClips.get(name)!.duration); model.updateMatrixWorld(true);
        for (let b = 0; b < skeleton.bones.length; b++) matrices.push(...matrix.multiplyMatrices(skeleton.bones[b].matrixWorld, skeleton.boneInverses[b]).elements);
      }
      this.texture = clipTexture({ parts: skeleton.bones.map(b => b.name), matrices, frames: samples * names.length, duration: names.length }); this.clips = names; this.frames = samples;
    }
    this.bytes = this.texture.image.data!.byteLength;
    this.pose = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3); geometry.setAttribute('_lab_pose', this.pose);
    const material = new MeshLambertNodeMaterial({ vertexColors: true });
    this.mesh = new InstancedMesh(geometry, material, capacity); this.mesh.frustumCulled = false;
    const matrices = new InstancedInterleavedBuffer(this.mesh.instanceMatrix.array, 16, 1);
    this.mesh.onBeforeRender = () => { matrices.version = this.mesh.instanceMatrix.version; };
    const column = (offset: number) => instancedBufferAttribute(matrices, 'vec4' as const, 16, offset);
    const instance = mat4(column(0), column(4), column(8), column(12));
    const state = attribute('_lab_pose', 'vec3');
    const vertex = (index: Parameters<typeof crowdMatrix>[1], value: ReturnType<typeof vec4>) => {
      const current = crowdMatrix(this.texture, index, state.x).mul(value);
      return prototype ? mix(crowdMatrix(this.texture, index, state.y).mul(value), current, state.z) : current;
    };
    const position = vec4(positionGeometry, 1), normal = vec4(normalGeometry, 0);
    if (prototype) {
      const joint = attribute('_joints', 'vec3');
      material.positionNode = instance.mul(mix(vertex(joint.x, position), vertex(joint.y, position), joint.z)).xyz;
      material.normalNode = cameraViewMatrix.mul(instance).mul(mix(vertex(joint.x, normal), vertex(joint.y, normal), joint.z)).xyz.normalize();
    } else {
      const joint = attribute('_part_index', 'float');
      material.positionNode = instance.mul(vertex(joint, position)).xyz;
      material.normalNode = cameraViewMatrix.mul(instance).mul(vertex(joint, normal)).xyz.normalize();
    }
    this.transition = Array.from({ length: capacity }, () => ({ clip: 'idle', from: 0, blend: 1 }));
  }
  update(states: Motion[], positions: Vector3[], kind = 'infected'): void {
    this.mesh.count = states.length;
    for (let i = 0; i < states.length; i++) {
      const m = states[i], clip = m.speed < .06 ? 'idle' : m.speed > 2 ? kind === 'infected' && !this.prototype ? 'infected-run' : 'run' : this.civilian ? 'npc-walk' : this.prototype ? 'walk' : 'shamble';
      const phase = strides[clip] ? m.distance / (strides[clip] * this.scale) % 1 : (m.distance + i * .137) % 1;
      const frame = this.clips.indexOf(clip) * this.frames + phase * (this.frames - 1), transition = this.transition[i];
      if (clip !== transition.clip) { transition.from = this.pose.getX(i); transition.clip = clip; transition.blend = 0; }
      transition.blend = Math.min(1, transition.blend + dt / .16);
      this.pose.setXYZ(i, frame, transition.from, transition.blend);
      this.matrix.makeRotationY(m.yaw); this.matrix.setPosition(positions[i]); this.mesh.setMatrixAt(i, this.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = this.pose.needsUpdate = true;
  }
  landmark(index: number, name: string, world = true): Vector3 {
    const part = this.parts.indexOf(name), data = this.texture.image.data as Float32Array;
    const sample = (frame: number) => {
      const low = new Matrix4().fromArray(data, (Math.floor(frame) * this.parts.length + part) * 16), high = new Matrix4().fromArray(data, (Math.ceil(frame) * this.parts.length + part) * 16);
      for (let i = 0; i < 16; i++) low.elements[i] += (high.elements[i] - low.elements[i]) * (frame % 1);
      return (this.restPoints.get(name)?.clone() ?? new Vector3()).applyMatrix4(low);
    };
    const point = sample(this.pose.getX(index));
    if (this.prototype) point.lerp(sample(this.pose.getY(index)), 1 - this.pose.getZ(index));
    if (world) { this.mesh.getMatrixAt(index, this.matrix); point.applyMatrix4(this.matrix); }
    return point;
  }
  supportPhase(state: Motion): number {
    const name = state.speed > 2 ? this.prototype ? 'run' : 'infected-run' : this.civilian ? 'npc-walk' : this.prototype ? 'walk' : 'shamble';
    return state.distance / (strides[name] * this.scale) % 1;
  }
  dispose(): void { this.mesh.geometry.dispose(); (this.mesh.material as MeshLambertNodeMaterial).dispose(); this.mesh.dispose(); this.texture.dispose(); }
}
