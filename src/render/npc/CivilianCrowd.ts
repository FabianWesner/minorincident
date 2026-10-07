// E07 GPU rigid-part crowd path, adapted from Bruno InstancedGroup.js (MIT).
import { Color, Group, InstancedMesh, InstancedBufferAttribute, InstancedInterleavedBuffer, Matrix4, MeshLambertNodeMaterial, BufferAttribute, Vector3, type DataTexture } from 'three/webgpu';
import { attribute, instancedBufferAttribute, mat4, mix, normalGeometry, positionGeometry, vec3, vec4, cameraViewMatrix, luminance } from 'three/tsl';
import type { Materials } from '../Materials';
import { crowdBlendedMatrix, packCrowdParts } from '../../assets/crowd';
import { AssetRegistry } from '../../assets/registry';
import { civilianRoles } from '../../data/npcs';
import type { SimWorld } from '../../sim/world/SimWorld';
import { bakeInfected, framesPerClip, civilianClips } from '../characters/bakeInfected';
import { RoutineProps } from './RoutineProps';
import type { CrowdClip } from '../../assets/crowd';
import { CrowdPosePalette } from '../characters/CrowdPosePalette';
import { MotionPresentation } from '../characters/MotionPresentation';
import { MotionPhase } from '../characters/MotionPhase';
import { authoredClips, strides } from '../characters/clips';
import { disposeCharacter } from '../characters/rig';
import { createCivilianPlaceholder } from './placeholders';
import { loadMeasure } from '../../assets/loadTiming';
import { keepsLook } from '../../sim/outbreak/appearance';
import type { EntitySnapshot } from '../../sim/world/types';
/** Main garment materials per civilian model (first = reference shade) that take the per-person shirt tint. */
const shirtMaterials: Record<string, string[]> = {
  'npc.civilian-man-a': ['pal_polo', 'pal_poloDark', 'pal_poloLight'],
  'npc.civilian-man-b': ['pal_schoolBusYellow', 'pal_hoodieShade'],
  'npc.civilian-woman-a': ['pal_survivorRed'],
  'npc.civilian-woman-b': ['pal_lavender', 'pal_lavenderLight', 'pal_lavenderShadow'],
  'npc.civilian-elderly': ['pal_vest'],
};
type Clip = typeof civilianClips[number];
/** Lane G's civilian panic and infected tier clips when baked, else the closest shared clip. */
const clipOr = (name: string, fallback: Clip): Clip => (civilianClips as readonly string[]).includes(name) ? name as Clip : fallback;
const tierGait = { frail: clipOr('infected-frail', 'infected-run'), average: clipOr('infected-lurch', 'infected-run'), athletic: clipOr('infected-sprint', 'infected-run') } as const;
const civStartle = clipOr('civ-startle', 'hurt'), civFlee = clipOr('civ-flee', 'run'), civGrabbed = clipOr('civ-grabbed', 'hurt');
/** Wandering infected never jog upright: below run speed every tier lurches (frail shuffles), arms forward. */
const slowGait = { frail: clipOr('infected-frail', 'shamble'), average: clipOr('infected-lurch', 'shamble'), athletic: clipOr('infected-lurch', 'shamble') } as const;
const infectedIdle = clipOr('infected-idle', 'idle'), infectedSearch = clipOr('infected-search', 'idle');
/** One human crowd draw regardless of density; poses, veins, eyes and clothing vary per instance. */
class CivilianBatch extends Group {
  private poses!: CrowdPosePalette;
  private mesh!: InstancedMesh;
  private bakedClip!: CrowdClip;
  private readonly hand = new Matrix4();
  private readonly nextHand = new Matrix4();
  private texture!: DataTexture;
  private readonly childScale = new Vector3(.7, .7, .7);
  private readonly transform = new Matrix4();
  private readonly lean = new Matrix4().makeRotationZ(-.34);
  private readonly sway = new Matrix4();
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
  constructor(readonly world: SimWorld, readonly model: string, readonly distant: boolean, private readonly shading?: Materials, private readonly props?: RoutineProps) { super(); this.name = 'civilian-crowd'; }
  async init(): Promise<void> {
    const loaded = await this.registry.loadAsset(this.model, this.distant ? 'lod2' : 'lod1');
    const placeholder = loaded.userData.placeholder, model = placeholder ? createCivilianPlaceholder() : loaded as Group;
    this.source = placeholder ? 'placeholder' : 'glb';
    const baked = bakeInfected(model, [], false, civilianClips), color = baked.geometry.getAttribute('color'), veins = new Float32Array(color.count), veinColor = new Color('#422c68');
    this.strideScale = baked.strideScale;
    // QA1-07: the civilian GLBs have no tintable `pal_infectedShirt`; their main garment materials take the per-person
    // tint instead, keeping each shade's brightness ratio (dark seams stay darker), so 5 silhouettes x 12 tints differ.
    const garment = shirtMaterials[this.model], shirtColors: Color[] = [];
    if (garment && !placeholder) model.traverse(node => { const m = (node as import('three').Mesh).material as import('three').MeshStandardMaterial | undefined; if (m && !Array.isArray(m) && garment.includes(m.name) && m.color) shirtColors[garment.indexOf(m.name)] = m.color.clone(); });
    const shirtAttr = baked.geometry.getAttribute('_shirt'), main = shirtColors.find(Boolean);
    if (main) for (let i = 0; i < color.count; i++) {
      if (shirtAttr.getX(i) < 0) continue;
      const r = color.getX(i), g = color.getY(i), b = color.getZ(i);
      if (shirtColors.some(c => c && Math.abs(c.r - r) < .002 && Math.abs(c.g - g) < .002 && Math.abs(c.b - b) < .002)) shirtAttr.setX(i, Math.min(1.6, Math.max(.35, (.2126 * r + .7152 * g + .0722 * b) / Math.max(.02, .2126 * main.r + .7152 * main.g + .0722 * main.b))));
    }
    // Packed mark channel: 1 = vein decal vertex, 2 = blood mask (lower face; collar bite on the torso).
    const position = baked.geometry.getAttribute('position'), partOf = baked.geometry.getAttribute('_part_index'), shirtOf = baked.geometry.getAttribute('_shirt');
    const head = baked.clip.parts.indexOf('head'), torso = baked.clip.parts.indexOf('torso'), bounds = [head, torso].map(() => ({ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }));
    for (let i = 0; i < color.count; i++) { const k = [head, torso].indexOf(partOf.getX(i)); if (k < 0) continue; for (let a = 0; a < 3; a++) { const v = position.getComponent(i, a); bounds[k].min[a] = Math.min(bounds[k].min[a], v); bounds[k].max[a] = Math.max(bounds[k].max[a], v); } }
    const rel = (k: number, i: number, a: number) => (position.getComponent(i, a) - bounds[k].min[a]) / Math.max(1e-6, bounds[k].max[a] - bounds[k].min[a]);
    for (let i = 0; i < veins.length; i++) {
      veins[i] = Number(Math.abs(color.getX(i) - veinColor.r) < .0001 && Math.abs(color.getY(i) - veinColor.g) < .0001);
      // Forward is +X: the front-lower third of the face, and the front-upper collar on one side of the torso.
      const p = partOf.getX(i);
      if (veins[i]) continue;
      // Irregular splatter on the shirt front (stable per vertex), so blood reads on clothes at the game camera.
      const splat = p === torso && rel(1, i, 0) > .5 && rel(1, i, 1) > .25 && Math.abs(Math.sin(position.getComponent(i, 0) * 91.7 + position.getComponent(i, 1) * 47.3 + position.getComponent(i, 2) * 63.1) * 43758.5) % 1 > .25;
      if (p === head && shirtOf.getX(i) < 0 && rel(0, i, 0) > .62 && rel(0, i, 1) < .42 || p === torso && rel(1, i, 1) > .8 && rel(1, i, 2) > .55 && rel(1, i, 0) > .35 || splat) veins[i] = 2;
      // Sunken, bruised eye sockets around the (glowing) eyes.
      else if (p === head && shirtOf.getX(i) < 0 && rel(0, i, 0) > .55 && rel(0, i, 1) > .45 && rel(0, i, 1) < .75) veins[i] = 3;
    }
    baked.geometry.setAttribute('_vein', new BufferAttribute(veins, 1));
    baked.geometry.setAttribute('_clip_frame', this.frame); baked.geometry.setAttribute('_variant', this.tint); baked.geometry.setAttribute('_overlay', this.overlay);
    this.bakedClip = baked.clip;
    this.poses = new CrowdPosePalette(baked.clip, 128); this.texture = this.poses.texture;
    packCrowdParts(baked.geometry);
    const parts = attribute('_parts', 'vec4'), variant = attribute('_variant', 'vec4');
    const overlay = attribute('_overlay', 'vec3'), eye = parts.z, vein = parts.w.greaterThan(.5).select(parts.w.lessThan(1.5).select(1, 0), 0), blood = parts.w.greaterThan(1.5).select(parts.w.lessThan(2.5).select(1, 0), 0), socket = parts.w.greaterThan(2.5).select(1, 0), decay = overlay.x;
    // parts.y > 0: tinted garment, value = the shade's brightness relative to the main garment colour.
    const clothing = parts.y.greaterThan(0).select(variant.xyz.mul(parts.y), attribute('color', 'vec3'));
    // Same clothes and body: only the skin blends toward ash-green, blood darkens mouth and bite, eyes ignite.
    // Skin only: drained grey-green (desaturated, darker), at up to 70 % for the 40 % sim blend so it reads at distance.
    // QA1-10: the infected must read at the default zoom - clearly ash-green skin (full shift at the 40 % sim blend),
    // dark sockets, grimy clothes (same colours, 25 % darker) and blood; hair, clothes and body stay the person's own.
    const sick = mix(vec3(luminance(clothing)).mul(.6), vec3(.42, .58, .30), .8), skinShift = parts.y.lessThan(0).select(decay.mul(2.5).min(1), 0);
    const sunken = mix(sick, vec3(.18, .02, .03), socket.mul(.9));
    const grimy = clothing.mul(overlay.z.mul(-.42).add(1));
    const skin = mix(grimy, sunken, skinShift);
    const bloody = mix(skin, vec3(.36, .02, .03), blood.mul(overlay.z).mul(.9));
    const base = mix(bloody, mix(vec3(.02), vec3(1, .015, .025), overlay.y), eye);
    const eyeColor = vec3(1, .005, .02);
    // Red glowing eyes in dark sockets. Kept below the bloom whiteout point: the emissive is a pure red (no luminance
    // normalisation, which pushed it to ~14x and bloomed the whole head white) at a capped strength.
    // The sockets glow a dim red around the eyes so the read survives 10-15 m, still far below the bloom whiteout.
    // A faint ash-green self-glow on infected skin so the colour shift survives building shadow (far below bloom).
    const glow = eyeColor.mul(eye.mul(2.2).add(socket.mul(.75))).mul(overlay.y).add(vec3(.05, .1, .03).mul(skinShift).mul(overlay.z));
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
      const activity = c.schedule?.[c.scheduleStep ?? 0];
      const performing = c.state === 'calm' && !!c.activityUntil;
      const elapsed = (this.world.tick - (c.activityStarted ?? this.world.tick)) / 60;
      const noticingSeated = c.state === 'alarmed' && !!activity?.seat && !!c.activityUntil;
      const noticeElapsed = (this.world.tick - c.entered) / 60;
      const routineClip: Clip = activity?.activity === 'stand' ? 'npc-stand-up' : activity?.activity === 'sit' ? elapsed < .6 ? 'npc-sit-down' : 'npc-sit' : activity?.activity === 'water' ? 'npc-water' : activity?.activity === 'chat' ? 'npc-gesture' : 'npc-look-around';
      const annoyed = c.state === 'annoyed' && this.world.tick - c.entered < 24;
      const walkClip: Clip = activity?.prop === 'cane' ? 'npc-cane' : activity?.prop ? 'npc-carry' : e.id % 2 ? 'npc-walk' : 'npc-walk-relaxed';
      // E19 story beats override the routine (render-only, set by the mission script).
      const storyClip = c.story && (civilianClips as readonly string[]).includes(c.story.clip) ? c.story.clip as Clip : null;
      const clip: Clip = storyClip && c.state === 'calm' ? storyClip : annoyed ? 'stagger-left' : c.state === 'down' ? 'infection-collapse' : down ? 'death-side' : rising ? 'infection-rise' : c.state === 'bitten' ? 'infection-stagger' : c.state === 'grabbed' ? c.l1 ? civGrabbed : 'hurt' : startle ? civStartle : c.state === 'alarmed' ? noticingSeated && noticeElapsed < .6 ? 'npc-stand-up' : 'npc-look-around' : performing && activity?.activity !== 'walk' ? routineClip : speed > 2.5 ? c.l1 && c.state === 'flee' ? civFlee : 'run' : speed > .06 ? walkClip : c.schedule ? 'npc-look-around' : 'idle';
      const duration = authoredClips.get(clip)!.duration, gaitDistance = Math.max(0, motion.distance - motion.speed * (1 - alpha) / 60);
      const phase = annoyed ? Math.min(1, (this.world.tick - c.entered) / 24) : clip === 'npc-sit-down' || clip === 'npc-stand-up' ? Math.min(1, (noticingSeated ? noticeElapsed : elapsed) / .6) : c.state === 'down' || c.state === 'bitten' || rising ? Math.min(1, (this.world.tick - c.entered) / Math.max(1, c.until - c.entered)) : startle ? Math.min(civStartle === 'hurt' ? .5 : 1, (this.world.tick - c.entered) / Math.max(1, c.until - c.entered)) : down ? 1 : strides[clip] ? gaitDistance / (strides[clip] * this.strideScale * (c.adult ? 1 : .7)) % 1 : (renderTick / 60 + e.id * .137) / duration % 1;
      const storyElapsed = storyClip && clip === storyClip && !strides[clip] ? (this.world.tick - c.story!.start) / 60 / authoredClips.get(clip)!.duration : null;
      const storyFrame = storyElapsed === null ? null : clip === 'npc-wave-in' || clip === 'npc-glance' ? storyElapsed % 1 : Math.min(.999, storyElapsed);
      const presented = this.presentation.sample(e.id, e.transform, this.world.tick, alpha);
      // Convulsions while on the ground: a seeded body shudder that grows with the infection.
      this.transform.makeRotationY(presented.yaw + (down && c.state !== 'finished' ? Math.sin(this.world.tick * .9 + e.id) * Math.max(c.veins, e.infection ? .4 : 0) * (e.infection ? .09 : .012) : 0)); if (!c.adult) this.transform.scale(this.childScale); this.transform.setPosition(presented.x, presented.y - .7, presented.z);
      if ((performing || noticingSeated) && activity?.seat) {
        const seatBlend = noticingSeated ? Math.max(0, 1 - noticeElapsed / .6) : activity.activity === 'stand' ? Math.max(0, 1 - elapsed / .6) : Math.min(1, elapsed / .6);
        this.transform.setPosition(presented.x + (activity.seat.x - presented.x) * seatBlend, presented.y - .7, presented.z + (activity.seat.z - presented.z) * seatBlend);
      }
      const frame = civilianClips.indexOf(clip) * framesPerClip + (storyFrame ?? phase) * (framesPerClip - 1);
      const blend = this.poses.sample(e.id, clip, frame, renderTick / 60);
      this.mesh.setMatrixAt(index, this.transform); this.frame.setX(index, frame);
      // A dropped hand prop (startle, bite) stays dropped: `appearance.handProp` is cleared by the outbreak layer.
      const handProp = c.story ? c.story.prop : activity?.prop;
      if (handProp && c.state === 'calm' && this.props && (c.story || e.appearance?.handProp !== null)) {
        const part = this.bakedClip.parts.indexOf('handR'), stride = this.bakedClip.parts.length * 16;
        this.hand.fromArray(this.bakedClip.matrices, Math.floor(frame) * stride + part * 16);
        this.nextHand.fromArray(this.bakedClip.matrices, Math.ceil(frame) * stride + part * 16);
        const handBlend = frame % 1;
        for (let i = 0; i < 16; i++) this.hand.elements[i] += (this.nextHand.elements[i] - this.hand.elements[i]) * handBlend;
        this.hand.premultiply(this.transform); this.props.place(handProp, this.hand);
      }
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
    let clip: Clip = b.state === 'dead' ? 'death-back' : b.state === 'attack' ? tick < b.until ? 'windup' : 'swing' : motion.speed > 2.6 ? tierGait[e.appearance!.tier] : motion.speed > .06 ? slowGait[e.appearance!.tier] : (b.state as string) === 'search' ? infectedSearch : infectedIdle;
    if (reaction && age < (reaction.heavy ? 1.34 : .43) && b.state !== 'dead') clip = reaction.heavy ? age < .7 ? 'knockdown' : 'get-up' : reaction.index % 2 ? 'stagger-left' : 'stagger-right';
    const duration = authoredClips.get(clip)!.duration, renderTick = Math.max(0, tick + alpha - 1);
    const phase = b.state === 'dead' ? Math.min(1, (tick - b.deadAt) / 60 / duration) : clip === 'windup' ? .5 : clip === 'get-up' ? Math.min(1, (age - .7) / .64) : reaction && age < 1.34 ? Math.min(1, age / (reaction.heavy ? .7 : .43)) : strides[clip] ? motion.distance / (strides[clip] * this.strideScale) % 1 : (renderTick / 60 + e.id * .137) / duration % 1;
    const presented = this.presentation.sample(e.id, e.transform, tick, alpha);
    // Hunched silhouette: the whole body leans forward (pivot at the feet) on top of the tier gait's arms-forward pose.
    // QA2b: the read holds in every state - standing/searching infected sway and twitch on top of the hunch.
    const still = motion.speed <= .06 && b.state !== 'dead', t = tick / 60 + e.id * .71;
    this.transform.makeRotationY(presented.yaw + (still ? Math.sin(t * 1.7) * .14 + (Math.sin(t * 7.3) > .93 ? .18 : 0) : 0));
    if (b.state !== 'dead' && !reaction) { this.transform.multiply(this.lean).multiply(this.sway.makeRotationX((e.id % 2 ? .17 : -.17) + Math.sin(t * 1.3) * .04)); if (still) this.transform.multiply(this.sway.makeRotationZ(-.14 - Math.abs(Math.sin(t * 2.3)) * .1)); }
    this.transform.setPosition(presented.x, presented.y - .7, presented.z);
    const frame = civilianClips.indexOf(clip) * framesPerClip + phase * (framesPerClip - 1), blend = this.poses.sample(e.id, clip, frame, renderTick / 60);
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
  private readonly props: RoutineProps;
  constructor(world: SimWorld, shading?: Materials) { super(); this.props = new RoutineProps(shading); this.add(this.props); this.batches=['npc.lab-tech-a','npc.lab-tech-b','npc.lab-guard','npc.civilian-man-a','npc.civilian-man-b','npc.civilian-woman-a','npc.civilian-woman-b','npc.civilian-elderly','npc.depot-clerk','npc.firefighter-alive'].flatMap(model=>[new CivilianBatch(world,model,false,shading,this.props),new CivilianBatch(world,model,true,shading,this.props)]); this.add(...this.batches); }
  async init(): Promise<void> { const started = performance.now(); await Promise.all(this.batches.map(b=>b.init())); loadMeasure('view:civilian-crowd', started); this.update(); }
  update(alpha = 1): void { this.props.begin(); this.batches.forEach(b=>b.update(alpha)); this.props.finish(); }
  snapshot() { const states=this.batches.map(b=>b.snapshot());return {instances:states.reduce((n,s)=>n+s.instances,0),draws:states.reduce((n,s)=>n+s.draws,0),source:states.every(s=>s.source==='glb')?'glb':'placeholder'}; }
  dispose(): void { this.props.dispose(); this.batches.forEach(b=>b.dispose());this.clear(); }
}
