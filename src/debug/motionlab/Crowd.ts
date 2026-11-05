import { DoubleSide, FrontSide, Group, InstancedBufferAttribute, InstancedInterleavedBuffer, InstancedMesh, Matrix4, MeshLambertNodeMaterial, Vector3, type DataTexture } from 'three/webgpu';
import { attribute, cameraViewMatrix, instancedBufferAttribute, mat4, normalGeometry, positionGeometry, texture, uv, vec4 } from 'three/tsl';
import { packCrowdParts } from '../../assets/crowd';
import { bakeInfected, framesPerClip } from '../../render/characters/bakeInfected';
import { skinnedCrowdMatrix } from '../../render/characters/skinnedCrowd';
import { strides } from '../../render/characters/clips';
import { CrowdPosePalette } from '../../render/characters/CrowdPosePalette';
import { dt, type Motion } from './Motion';

const names = ['idle', 'walk', 'run', 'npc-walk', 'shamble', 'infected-run'] as const;
export class LabCrowd {
  readonly mesh: InstancedMesh;
  readonly texture: DataTexture;
  private readonly palette: CrowdPosePalette;
  private time = 0;
  private readonly pose: InstancedBufferAttribute;
  private readonly scale: number;
  private readonly matrix = new Matrix4();
  readonly bytes: number;
  private readonly parts: string[];
  constructor(model: Group, capacity: number, private readonly prototype: boolean, private readonly civilian = false) {
    // Use the production bake for every mesh and all four skin influences, including eyes and attachments.
    const baked = bakeInfected(model, [], false, names), geometry = baked.geometry;
    packCrowdParts(geometry);
    this.scale = baked.strideScale; this.parts = baked.clip.parts;
    this.palette = new CrowdPosePalette(baked.clip, capacity); this.texture = this.palette.texture;
    this.bytes = this.texture.image.data!.byteLength;
    this.pose = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3); geometry.setAttribute('_lab_pose', this.pose);
    const material = new MeshLambertNodeMaterial({ vertexColors: true, side: baked.doubleSided ? DoubleSide : FrontSide });
    if (baked.texture) material.colorNode = attribute('color', 'vec3').mul(texture(baked.texture, uv()).rgb);
    this.mesh = new InstancedMesh(geometry, material, capacity); this.mesh.frustumCulled = false;
    const matrices = new InstancedInterleavedBuffer(this.mesh.instanceMatrix.array, 16, 1);
    this.mesh.onBeforeRender = () => { matrices.version = this.mesh.instanceMatrix.version; };
    const column = (offset: number) => instancedBufferAttribute(matrices, 'vec4' as const, 16, offset);
    const instance = mat4(column(0), column(4), column(8), column(12)), state = attribute('_lab_pose', 'vec3');
    const skin = skinnedCrowdMatrix(this.texture, attribute('_parts', 'vec4').x, state.x, state.y, state.z, this.palette.bindRow);
    material.positionNode = instance.mul(skin.mul(vec4(positionGeometry, 1))).xyz;
    material.normalNode = cameraViewMatrix.mul(instance).mul(skin.mul(vec4(normalGeometry, 0))).xyz.normalize();
  }
  update(states: Motion[], positions: Vector3[], kind = 'infected'): void {
    this.time += dt; this.mesh.count = states.length;
    for (let i = 0; i < states.length; i++) {
      const m = states[i], clip = m.speed < .06 ? 'idle' : m.speed > 2 ? kind === 'infected' ? 'infected-run' : 'run' : this.civilian ? 'npc-walk' : 'shamble';
      const phase = strides[clip] ? m.distance / (strides[clip] * this.scale) % 1 : (m.distance + i * .137) % 1;
      const frame = names.indexOf(clip) * framesPerClip + phase * (framesPerClip - 1);
      const [outgoing, weight] = this.prototype ? this.palette.sample(i, clip, frame, this.time) : [frame, 1];
      this.pose.setXYZ(i, frame, outgoing, weight);
      this.matrix.makeRotationY(m.yaw); this.matrix.setPosition(positions[i]); this.mesh.setMatrixAt(i, this.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = this.pose.needsUpdate = true;
  }
  landmark(index: number, name: string, world = true): Vector3 {
    this.palette.part(this.pose.getX(index), this.pose.getY(index), this.pose.getZ(index), this.parts.indexOf(name), this.matrix);
    const point = new Vector3().setFromMatrixPosition(this.matrix);
    if (world) { this.mesh.getMatrixAt(index, this.matrix); point.applyMatrix4(this.matrix); }
    return point;
  }
  supportPhase(state: Motion): number {
    const name = state.speed > 2 ? this.civilian ? 'run' : 'infected-run' : this.civilian ? 'npc-walk' : 'shamble';
    return state.distance / (strides[name] * this.scale) % 1;
  }
  dispose(): void { this.mesh.geometry.dispose(); (this.mesh.material as MeshLambertNodeMaterial).dispose(); this.mesh.dispose(); this.texture.dispose(); }
}
