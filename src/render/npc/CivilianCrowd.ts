// E07 GPU rigid-part crowd path, adapted from Bruno InstancedGroup.js (MIT).
import { Color, Group, InstancedMesh, InstancedBufferAttribute, InstancedInterleavedBuffer, Matrix4, MeshLambertNodeMaterial, BufferAttribute, Vector3, type DataTexture } from 'three/webgpu';
import { attribute, instancedBufferAttribute, mat4, mix, normalGeometry, positionGeometry, vec3, vec4, cameraViewMatrix, luminance } from 'three/tsl';
import type { Materials } from '../Materials';
import { crowdBlendedMatrix, packCrowdParts } from '../../assets/crowd';
import { AssetRegistry } from '../../assets/registry';
import { civilianRoles } from '../../data/npcs';
import type { SimWorld } from '../../sim/world/SimWorld';
import { bakeInfected, framesPerClip, infectedClips } from '../characters/bakeInfected';
import { CrowdPosePalette } from '../characters/CrowdPosePalette';
import { MotionPresentation } from '../characters/MotionPresentation';
import { MotionPhase } from '../characters/MotionPhase';
import { authoredClips, strides } from '../characters/clips';
import { disposeCharacter } from '../characters/rig';
import { createCivilianPlaceholder } from './placeholders';
import { keepsLook } from '../../sim/outbreak/appearance';
import type { EntitySnapshot } from '../../sim/world/types';
/** One human crowd draw regardless of density; poses, veins, eyes and clothing vary per instance. */
class CivilianBatch extends Group {
  private poses!: CrowdPosePalette;
  private mesh!: InstancedMesh;
  private texture!: DataTexture;
  private readonly childScale = new Vector3(.7, .7, .7);
  private readonly transform = new Matrix4();
  private readonly presentation = new MotionPresentation();
  private readonly motion = new MotionPhase();
  private strideScale = 1;
  private readonly colors = civilianRoles.map(d => new Color(d.color));
  private readonly frame = new InstancedBufferAttribute(new Float32Array(128), 1);
  private readonly tint = new InstancedBufferAttribute(new Float32Array(128 * 4), 4);
  /** Infection overlay per instance: x skin blend toward ash-green, y eye glow, z blood (mouth and bite). */
  private readonly overlay = new InstancedBufferAttribute(new Float32Array(128 * 3), 3);
  private readonly shirt = new Color();
  private readonly registry = new AssetRegistry(() => {});
  source = 'placeholder';
  constructor(readonly world: SimWorld, readonly model: string, readonly distant: boolean, private readonly shading?: Materials) { super(); this.name = 'civilian-crowd'; }
  async init(): Promise<void> {
    const loaded = await this.registry.loadAsset(this.model, this.distant ? 'lod2' : 'lod1');
    const placeholder = loaded.userData.placeholder, model = placeholder ? createCivilianPlaceholder() : loaded as Group;
    this.source = placeholder ? 'placeholder' : 'glb';
    const baked = bakeInfected(model), color = baked.geometry.getAttribute('color'), veins = new Float32Array(color.count), veinColor = new Color('#422c68');
    this.strideScale = baked.strideScale;
    // Packed mark channel: 1 = vein decal vertex, 2 = blood mask (lower face; collar bite on the torso).
    const position = baked.geometry.getAttribute('position'), partOf = baked.geometry.getAttribute('_part_index'), shirtOf = baked.geometry.getAttribute('_shirt');
    const head = baked.clip.parts.indexOf('head'), torso = baked.clip.parts.indexOf('torso'), bounds = [head, torso].map(() => ({ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }));
    for (let i = 0; i < color.count; i++) { const k = [head, torso].indexOf(partOf.getX(i)); if (k < 0) continue; for (let a = 0; a < 3; a++) { const v = position.getComponent(i, a); bounds[k].min[a] = Math.min(bounds[k].min[a], v); bounds[k].max[a] = Math.max(bounds[k].max[a], v); } }
    const rel = (k: number, i: number, a: number) => (position.getComponent(i, a) - bounds[k].min[a]) / Math.max(1e-6, bounds[k].max[a] - bounds[k].min[a]);
    for (let i = 0; i < veins.length; i++) {
      veins[i] = Number(Math.abs(color.getX(i) - veinColor.r) < .0001 && Math.abs(color.getY(i) - veinColor.g) < .0001);
      // Forward is +X: the front-lower third of the face, and the front-upper collar on one side of the torso.
      const p = partOf.getX(i);
      if (!veins[i] && (p === head && shirtOf.getX(i) < 0 && rel(0, i, 0) > .62 && rel(0, i, 1) < .42 || p === torso && rel(1, i, 1) > .8 && rel(1, i, 2) > .55 && rel(1, i, 0) > .35)) veins[i] = 2;
    }
    baked.geometry.setAttribute('_vein', new BufferAttribute(veins, 1));
    baked.geometry.setAttribute('_clip_frame', this.frame); baked.geometry.setAttribute('_variant', this.tint); baked.geometry.setAttribute('_overlay', this.overlay);
    this.poses = new CrowdPosePalette(baked.clip, 128); this.texture = this.poses.texture;
    packCrowdParts(baked.geometry);
    const parts = attribute('_parts', 'vec4'), variant = attribute('_variant', 'vec4');
    const overlay = attribute('_overlay', 'vec3'), eye = parts.z, vein = parts.w.greaterThan(.5).select(parts.w.lessThan(1.5).select(1, 0), 0), blood = parts.w.greaterThan(1.5).select(1, 0), decay = overlay.x;
    const clothing = mix(attribute('color', 'vec3'), variant.xyz, parts.y.max(0));
    // Same clothes and body: only the skin blends toward ash-green, blood darkens mouth and bite, eyes ignite.
    const skin = mix(clothing, vec3(.31, .40, .27), parts.y.lessThan(0).select(decay, 0));
    const bloody = mix(skin, vec3(.33, .02, .03), blood.mul(overlay.z).mul(.85));
    const base = mix(bloody, mix(vec3(.02), vec3(1, .015, .025), overlay.y), eye);
    const eyeColor = vec3(1, .005, .02);
    const glow = eyeColor.div(luminance(eyeColor)).mul(eye).mul(overlay.y).mul(2);
    const material = this.shading?.shaded(base, glow) ?? Object.assign(new MeshLambertNodeMaterial(), { colorNode: base, emissiveNode: glow });
    this.mesh = new InstancedMesh(baked.geometry, material, 128); this.mesh.userData.preRenderSolo = true; this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.castShadow = this.mesh.receiveShadow = true;
    const matrices = new InstancedInterleavedBuffer(this.mesh.instanceMatrix.array, 16, 1); this.mesh.onBeforeRender = () => { matrices.version = this.mesh.instanceMatrix.version; };
    const column = (offset: number) => instancedBufferAttribute(matrices, 'vec4' as const, 16, offset), instance = mat4(column(0), column(4), column(8), column(12)), part = parts.x;
    const outgoing = variant.w.div(2).floor(), weight = variant.w.mod(2);
    const matrix = crowdBlendedMatrix(this.texture, part, attribute('_clip_frame', 'float'), outgoing, weight);
    material.positionNode = instance.mul(matrix.mul(vec4(positionGeometry.mul(vein.greaterThan(.5).select(decay.greaterThan(.25).select(1, 0), 1)), 1))).xyz;
    material.normalNode = instance.mul(matrix.mul(vec4(normalGeometry, 0))).xyz.transformDirection(cameraViewMatrix);
    this.add(this.mesh); if (placeholder) disposeCharacter(model); this.update();
  }
  update(alpha = 1): void {
    if (!this.mesh) return; let index = 0;
    const player = this.world.entities.get(1)!.transform, renderTick = Math.max(0, this.world.tick + alpha - 1);
    for (const e of this.world.entities.iterate()) {
      if (index >= 128) break;
      if (!e.civilian && e.infected && keepsLook(e)) { if (e.appearance!.asset === this.model && this.place(e, index, player, alpha)) index++; continue; }
      const c = e.civilian; if (!c || c.pet || e.hidden || c.state === 'infected') continue;
      if((Math.hypot(e.transform.x-player.x,e.transform.z-player.z)>30)!==this.distant)continue;
      if ((e.appearance?.asset ?? c.model ?? (['inf.suburban-mom','inf.bathrobe-neighbor'].includes(c.variant) ? 'npc.civilian-woman-a' : 'npc.civilian-man-a')) !== this.model) continue;
      const down = c.state === 'down' || c.state === 'finished' || this.world.tick < c.knockedUntil;
      const rising = c.state === 'rising', startle = c.state === 'alarmed' && !!c.l1;
      const motion = e.motion ?? this.motion.sample(e.id, this.world.tick, e.transform.x, e.transform.z);
      const speed = e.motion && !e.motion.moving ? 0 : motion.speed;
      const clip = c.state === 'down' ? 'infection-collapse' : down ? 'death-side' : rising ? 'infection-rise' : c.state === 'bitten' ? 'infection-stagger' : c.state === 'grabbed' || startle ? 'hurt' : speed > 2.5 ? 'run' : speed > .06 ? e.id % 2 ? 'npc-walk' : 'npc-walk-relaxed' : 'idle';
      const duration = authoredClips.get(clip)!.duration, gaitDistance = Math.max(0, motion.distance - motion.speed * (1 - alpha) / 60);
      const phase = c.state === 'down' || c.state === 'bitten' || rising ? Math.min(1, (this.world.tick - c.entered) / Math.max(1, c.until - c.entered)) : startle ? Math.min(.5, (this.world.tick - c.entered) / 40) : down ? 1 : strides[clip] ? gaitDistance / (strides[clip] * this.strideScale * (c.adult ? 1 : .7)) % 1 : (renderTick / 60 + e.id * .137) / duration % 1;
      const presented = this.presentation.sample(e.id, e.transform, this.world.tick, alpha);
      // Convulsions while on the ground: a seeded body shudder that grows with the infection.
      this.transform.makeRotationY(presented.yaw + (down && c.state !== 'finished' ? Math.sin(this.world.tick * .9 + e.id) * Math.max(c.veins, e.infection ? .4 : 0) * (e.infection ? .09 : .012) : 0)); if (!c.adult) this.transform.scale(this.childScale); this.transform.setPosition(presented.x, presented.y - .7, presented.z);
      const frame = infectedClips.indexOf(clip) * framesPerClip + phase * (framesPerClip - 1);
      const blend = this.poses.sample(e.id, clip, frame, renderTick / 60);
      this.mesh.setMatrixAt(index, this.transform); this.frame.setX(index, frame);
      this.tintOf(e, index, blend[0] * 2 + blend[1]);
      const glow = c.eyesGlow ? e.infection ? Math.min(1, (this.world.tick - (e.infection.endsTick - 78)) / 30) : Math.min(1, Math.max(0, (c.veins - .12) / .65)) : 0;
      this.overlay.setXYZ(index, c.veins, Math.max(0, glow), e.infection ? Math.min(1, Math.max(0, (e.infection.progress - .35) / .4)) : 0); index++;
    }
    this.mesh.count = index; this.mesh.instanceMatrix.needsUpdate = true; this.frame.needsUpdate = this.tint.needsUpdate = this.overlay.needsUpdate = true;
  }
  private tintOf(e: EntitySnapshot, index: number, blend: number): void {
    if (e.appearance) this.shirt.set(e.appearance.tint);
    else this.shirt.copy(this.colors[Math.max(0, civilianRoles.findIndex(d => d.variant === e.civilian?.variant))]);
    this.tint.setXYZW(index, this.shirt.r, this.shirt.g, this.shirt.b, blend);
  }
  /** A pedestrian who rose infected: same model and tint, full overlay, infected locomotion and fight clips. */
  private place(e: EntitySnapshot, index: number, player: { x: number; z: number }, alpha: number): boolean {
    const b = e.infected!, tick = this.world.tick, distance = Math.hypot(e.transform.x - player.x, e.transform.z - player.z);
    if (e.hidden || b.hidden || (distance > 30) !== this.distant || b.state === 'dead' && tick - b.deadAt > 540) return false;
    const motion = this.motion.sample(e.id, tick, e.transform.x, e.transform.z), reaction = e.combat?.reaction, age = reaction ? (tick - reaction.started) / 60 : Infinity;
    let clip: typeof infectedClips[number] = b.state === 'dead' ? 'death-back' : b.state === 'attack' ? tick < b.until ? 'windup' : 'swing' : motion.speed > 2 ? 'infected-run' : motion.speed > .06 ? 'shamble' : 'idle';
    if (reaction && age < (reaction.heavy ? 1.34 : .43) && b.state !== 'dead') clip = reaction.heavy ? age < .7 ? 'knockdown' : 'get-up' : reaction.index % 2 ? 'stagger-left' : 'stagger-right';
    const duration = authoredClips.get(clip)!.duration, renderTick = Math.max(0, tick + alpha - 1);
    const phase = b.state === 'dead' ? Math.min(1, (tick - b.deadAt) / 60 / duration) : clip === 'windup' ? .5 : clip === 'get-up' ? Math.min(1, (age - .7) / .64) : reaction && age < 1.34 ? Math.min(1, age / (reaction.heavy ? .7 : .43)) : strides[clip] ? motion.distance / (strides[clip] * this.strideScale) % 1 : (renderTick / 60 + e.id * .137) / duration % 1;
    const presented = this.presentation.sample(e.id, e.transform, tick, alpha);
    this.transform.makeRotationY(presented.yaw); this.transform.setPosition(presented.x, presented.y - .7, presented.z);
    const frame = infectedClips.indexOf(clip) * framesPerClip + phase * (framesPerClip - 1), blend = this.poses.sample(e.id, clip, frame, renderTick / 60);
    this.mesh.setMatrixAt(index, this.transform); this.frame.setX(index, frame);
    this.tintOf(e, index, blend[0] * 2 + blend[1]); this.overlay.setXYZ(index, .4, b.state === 'dead' ? 0 : 1, 1);
    return true;
  }
  snapshot() { return { instances: this.mesh?.count ?? 0, draws: this.mesh?.count ? 1 : 0, source: this.source }; }
  dispose(): void { if (this.mesh) { this.mesh.geometry.dispose(); (this.mesh.material as MeshLambertNodeMaterial).dispose(); this.mesh.dispose(); this.texture.dispose(); } void this.registry.dispose(); this.clear(); }
}

/** Five civilian silhouettes share rigid-part LOD batches and the E07 clip path. */
export class CivilianCrowd extends Group {
  private readonly batches: CivilianBatch[];
  constructor(world: SimWorld, shading?: Materials) { super(); this.batches=['npc.civilian-man-a','npc.civilian-man-b','npc.civilian-woman-a','npc.civilian-woman-b','npc.civilian-elderly'].flatMap(model=>[new CivilianBatch(world,model,false,shading),new CivilianBatch(world,model,true,shading)]); this.add(...this.batches); }
  async init(): Promise<void> { await Promise.all(this.batches.map(b=>b.init())); }
  update(alpha = 1): void { this.batches.forEach(b=>b.update(alpha)); }
  snapshot() { const states=this.batches.map(b=>b.snapshot());return {instances:states.reduce((n,s)=>n+s.instances,0),draws:states.reduce((n,s)=>n+s.draws,0),source:states.every(s=>s.source==='glb')?'glb':'placeholder'}; }
  dispose(): void { this.batches.forEach(b=>b.dispose());this.clear(); }
}
