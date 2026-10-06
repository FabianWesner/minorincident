// E07 GPU rigid-part crowd path, adapted from Bruno InstancedGroup.js (MIT).
import { Color, Group, InstancedMesh, InstancedBufferAttribute, InstancedInterleavedBuffer, Matrix4, MeshLambertNodeMaterial, BufferAttribute, Vector3, type DataTexture } from 'three/webgpu';
import { attribute, instancedBufferAttribute, mat4, mix, normalGeometry, positionGeometry, vec3, vec4, cameraViewMatrix, luminance } from 'three/tsl';
import type { Materials } from '../Materials';
import { clipTexture, crowdMatrix, crowdPosition } from '../../assets/crowd';
import { AssetRegistry } from '../../assets/registry';
import { civilianRoles } from '../../data/npcs';
import type { SimWorld } from '../../sim/world/SimWorld';
import { bakeInfected, framesPerClip, infectedClips } from '../characters/bakeInfected';
import { MotionPhase } from '../characters/MotionPhase';
import { authoredClips, strides } from '../characters/clips';
import { disposeCharacter } from '../characters/rig';
import { createCivilianPlaceholder } from './placeholders';
/** One human crowd draw regardless of density; poses, veins, eyes and clothing vary per instance. */
class CivilianBatch extends Group {
  private mesh!: InstancedMesh;
  private texture!: DataTexture;
  private readonly childScale = new Vector3(.7, .7, .7);
  private readonly transform = new Matrix4();
  private readonly motion = new MotionPhase();
  private strideScale = 1;
  private readonly colors = civilianRoles.map(d => new Color(d.color));
  private readonly frame = new InstancedBufferAttribute(new Float32Array(128), 1);
  private readonly tint = new InstancedBufferAttribute(new Float32Array(128 * 3), 3);
  private readonly glow = new InstancedBufferAttribute(new Float32Array(128), 1);
  private readonly decay = new InstancedBufferAttribute(new Float32Array(128), 1);
  private readonly registry = new AssetRegistry(() => {});
  source = 'placeholder';
  constructor(readonly world: SimWorld, readonly model: string, readonly distant: boolean, private readonly shading?: Materials) { super(); this.name = 'civilian-crowd'; }
  async init(): Promise<void> {
    const loaded = await this.registry.loadAsset(this.model, this.distant ? 'lod2' : 'lod1');
    const placeholder = loaded.userData.placeholder, model = placeholder ? createCivilianPlaceholder() : loaded as Group;
    this.source = placeholder ? 'placeholder' : 'glb';
    const baked = bakeInfected(model), color = baked.geometry.getAttribute('color'), veins = new Float32Array(color.count), veinColor = new Color('#422c68');
    this.strideScale = baked.strideScale;
    for (let i = 0; i < veins.length; i++) veins[i] = Number(Math.abs(color.getX(i) - veinColor.r) < .0001 && Math.abs(color.getY(i) - veinColor.g) < .0001);
    baked.geometry.setAttribute('_vein', new BufferAttribute(veins, 1));
    baked.geometry.setAttribute('_clip_frame', this.frame); baked.geometry.setAttribute('_variant', this.tint); baked.geometry.setAttribute('_glow', this.glow); baked.geometry.setAttribute('_decay', this.decay);
    this.texture = clipTexture(baked.clip);
    const eye = attribute('_emissive', 'float'), vein = attribute('_vein', 'float'), decay = attribute('_decay', 'float');
    const base = mix(mix(attribute('color', 'vec3'), attribute('_variant', 'vec3'), attribute('_shirt', 'float')), mix(vec3(.02), vec3(1, .015, .025), attribute('_glow', 'float')), eye);
    const eyeColor = vec3(1, .005, .02);
    const glow = eyeColor.div(luminance(eyeColor)).mul(eye).mul(attribute('_glow', 'float')).mul(2);
    const material = this.shading?.shaded(base, glow) ?? Object.assign(new MeshLambertNodeMaterial(), { colorNode: base, emissiveNode: glow });
    this.mesh = new InstancedMesh(baked.geometry, material, 128); this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.castShadow = this.mesh.receiveShadow = true;
    const matrices = new InstancedInterleavedBuffer(this.mesh.instanceMatrix.array, 16, 1); this.mesh.onBeforeRender = () => { matrices.version = this.mesh.instanceMatrix.version; };
    const column = (offset: number) => instancedBufferAttribute(matrices, 'vec4' as const, 16, offset), instance = mat4(column(0), column(4), column(8), column(12)), part = attribute('_part_index', 'float');
    material.positionNode = crowdPosition(instance, this.texture, part, attribute('_clip_frame', 'float'), positionGeometry.mul(vein.greaterThan(.5).select(decay.greaterThan(.25).select(1, 0), 1)));
    material.normalNode = instance.mul(crowdMatrix(this.texture, part, attribute('_clip_frame', 'float')).mul(vec4(normalGeometry, 0))).xyz.transformDirection(cameraViewMatrix);
    this.add(this.mesh); if (placeholder) disposeCharacter(model); this.update();
  }
  update(): void {
    if (!this.mesh) return; let index = 0;
    for (const e of this.world.entities.iterate()) {
      const c = e.civilian; if (!c || c.pet || e.hidden || c.state === 'infected') continue;
      const player=this.world.entities.get(1)!.transform;if((Math.hypot(e.transform.x-player.x,e.transform.z-player.z)>30)!==this.distant)continue;
      if ((c.model ?? (['inf.suburban-mom','inf.bathrobe-neighbor'].includes(c.variant) ? 'npc.civilian-woman-a' : 'npc.civilian-man-a')) !== this.model) continue;
      const down = c.state === 'down' || c.state === 'finished' || this.world.tick < c.knockedUntil;
      const rising = c.state === 'rising';
      const motion = e.motion ?? this.motion.sample(e.id, this.world.tick, e.transform.x, e.transform.z);
      const speed = e.motion && !e.motion.moving ? 0 : motion.speed;
      const clip = down ? 'death-side' : rising ? 'get-up' : c.state === 'grabbed' || c.state === 'bitten' ? 'hurt' : speed > 2.5 ? 'run' : speed > .06 ? e.id % 2 ? 'npc-walk' : 'npc-walk-relaxed' : 'idle';
      const duration = authoredClips.get(clip)!.duration;
      const phase = down ? 1 : rising ? Math.min(1, (this.world.tick - c.entered) / 72) : strides[clip] ? motion.distance / (strides[clip] * this.strideScale * (c.adult ? 1 : .7)) % 1 : (this.world.tick / 60 + e.id * .137) / duration % 1;
      this.transform.makeRotationY(e.transform.yaw + (down && c.state !== 'finished' ? Math.sin(this.world.tick * .9) * c.veins * .012 : 0)); if (!c.adult) this.transform.scale(this.childScale); this.transform.setPosition(e.transform.x, e.transform.y - .7, e.transform.z);
      this.mesh.setMatrixAt(index, this.transform); this.frame.setX(index, infectedClips.indexOf(clip) * framesPerClip + phase * (framesPerClip - 1));
      const role = civilianRoles.findIndex(d => d.variant === c.variant), color = this.colors[Math.max(0, role)]; this.tint.setXYZ(index, color.r, color.g, color.b); this.glow.setX(index, Number(c.eyesGlow)); this.decay.setX(index, c.veins); index++;
    }
    this.mesh.count = index; this.mesh.instanceMatrix.needsUpdate = true; this.frame.needsUpdate = this.tint.needsUpdate = this.glow.needsUpdate = this.decay.needsUpdate = true;
  }
  snapshot() { return { instances: this.mesh?.count ?? 0, draws: this.mesh?.count ? 1 : 0, source: this.source }; }
  dispose(): void { if (this.mesh) { this.mesh.geometry.dispose(); (this.mesh.material as MeshLambertNodeMaterial).dispose(); this.mesh.dispose(); this.texture.dispose(); } void this.registry.dispose(); this.clear(); }
}

/** Five civilian silhouettes share rigid-part LOD batches and the E07 clip path. */
export class CivilianCrowd extends Group {
  private readonly batches: CivilianBatch[];
  constructor(world: SimWorld, shading?: Materials) { super(); this.batches=['npc.civilian-man-a','npc.civilian-man-b','npc.civilian-woman-a','npc.civilian-woman-b','npc.civilian-elderly'].flatMap(model=>[new CivilianBatch(world,model,false,shading),new CivilianBatch(world,model,true,shading)]); this.add(...this.batches); }
  async init(): Promise<void> { await Promise.all(this.batches.map(b=>b.init())); }
  update(): void { this.batches.forEach(b=>b.update()); }
  snapshot() { const states=this.batches.map(b=>b.snapshot());return {instances:states.reduce((n,s)=>n+s.instances,0),draws:states.reduce((n,s)=>n+s.draws,0),source:states.every(s=>s.source==='glb')?'glb':'placeholder'}; }
  dispose(): void { this.batches.forEach(b=>b.dispose());this.clear(); }
}
