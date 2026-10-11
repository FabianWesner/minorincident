import { CrowdVisibility } from '../CrowdVisibility';
// E07 GPU rigid-part crowd path, adapted from Bruno InstancedGroup.js (MIT).
import { StaticCorpses } from '../characters/StaticCorpses';
import { CrowdFootwork, CrowdLocomotion } from '../characters/CrowdLocomotion';
import { InfectedMoves, getUpSpan } from '../characters/InfectedMoves';
import { infectedDefinitions } from '../../data/infected';
import { l6CastModels } from '../../data/l6';
import { GaitPhase } from '../characters/GaitPhase';
import { CrowdFigureProbe } from '../characters/CrowdFigureProbe';
import { Color, Group, InstancedMesh, InstancedBufferAttribute, InstancedInterleavedBuffer, InterleavedBufferAttribute, Matrix4, type MeshLambertNodeMaterial, Vector3, StreamDrawUsage, type DataTexture } from 'three/webgpu';
import type { Materials } from '../Materials';
import { civilianMaterial } from './CivilianMaterial';
import { AssetRegistry } from '../../assets/registry';
import { civilianRoles, l1Pedestrians, coreCivilianModels } from '../../data/npcs';
import type { SimWorld } from '../../sim/world/SimWorld';
import { framesPerClip, civilianClips } from '../characters/bakeInfected';
import { loadGate } from '../../assets/loadGate';
import { RoutineProps } from './RoutineProps';
import { uprightHand } from './civilianGrip';
import type { CivilianProp } from '../../sim/npc/types';
/** E22 weapons carried by soldiers and armed civilians: drawn at the hand whatever the routine or fight clip is. */
const weaponProps = new Set<string>(['rifle', 'pistol', 'hunting-rifle', 'pipe', 'bat', 'crowbar']);
import type { CrowdClip } from '../../assets/crowd';
import { CrowdPosePalette } from '../characters/CrowdPosePalette';
import { MotionPresentation, crowdTurnRate } from '../characters/MotionPresentation';
import { CrowdGunAim } from '../characters/GunAim';
import { MotionPhase } from '../characters/MotionPhase';
import { authoredClips, strides } from '../characters/clips';
import { disposeCharacter } from '../characters/rig';
import { createCivilianPlaceholder } from './placeholders';
import { loadMeasure } from '../../assets/loadTiming';
import { loadCivilianBake } from '../../assets/civilianBake';
import { keepsLook } from '../../sim/outbreak/appearance';
import type { EntitySnapshot } from '../../sim/world/types';
import { prepareCivilianGeometry, prepareCivilianRig, type PreparedCivilian } from './prepareCivilianGeometry';
export { restoreStanding } from './prepareCivilianGeometry';
// Cache prepared CPU geometry, including LOD simplification; each scene owns a clone.
const preparedCrowds = new Map<string, PreparedCivilian>();
// Retain at most the twelve core models' two common tiers. Different campaign casts
// must not accumulate pose atlases across repeated L1/L6 loads.
const preparedCrowdLimit = coreCivilianModels.length * 2;
type Clip = typeof civilianClips[number];
/** Models drawn from the first frame. Any other id found on an entity (`appearance.asset` or `civilian.model`, e.g. the L5/L6 aftermath and shelter skins) gets its lod1/lod2 batches on first sight, so new NPC ids need no code edit. */
/** The crowd model an entity draws with, or null when it is no crowd figure. */
export function crowdModelOf(e: EntitySnapshot): string | null {
  const c = e.civilian;
  // Old checkpoints may still contain an adult skin on a protected child.
  if (c?.adult === false && !c.pet) return 'npc.civilian-kid';
  return e.appearance?.asset ?? c?.model ?? (c ? ['inf.suburban-mom', 'inf.bathrobe-neighbor'].includes(c.variant) ? 'npc.civilian-woman-a' : 'npc.civilian-man-a' : null);
}
/** Story clips that cycle (beckoning, glancing, the E20 rescue panic and door forcing); the rest hold their last frame. */
const loopingStory = new Set<string>(['npc-wave-in', 'npc-glance', 'npc-bang', 'npc-plead', 'npc-press', 'npc-cower', 'npc-hug', 'ff-pry', 'npc-stand-back']);
const windups = new Map(infectedDefinitions.map(d => [d.id, d.windup]));
/** Lane G's civilian panic and infected tier clips when baked, else the closest shared clip. */
const clipOr = (name: string, fallback: Clip): Clip => (civilianClips as readonly string[]).includes(name) ? name as Clip : fallback;
const tierGait = { frail: clipOr('infected-frail', 'infected-run'), average: clipOr('infected-lurch', 'infected-run'), athletic: clipOr('infected-sprint', 'infected-run') } as const;
const civStartle = clipOr('civ-startle', 'hurt'), civFlee = clipOr('civ-flee', 'run'), civGrabbed = clipOr('civ-grabbed', 'hurt');
/**
 * The infected clip always follows the actual ground speed: idle/search below 0.2 m/s, lurch (frail shuffle) below run
 * speed, the tier gait above it. An attack swing only plays while (nearly) standing; a lunge or shove that moves the
 * body faster than 1.2 m/s keeps the legs running. Distance-driven phase (strides) makes the legs match the speed.
 */
export function infectedClip(state: string, speed: number, tier: 'frail' | 'average' | 'athletic', windup: boolean): Clip {
  if (state === 'dead') return 'death-back';
  // Below 0.1 m/s the body is standing (sim jitter and arrival creep); gait there would read as moon-walking.
  if (state === 'attack' && speed <= .1) return windup ? 'windup' : 'swing';
  if (speed > 2.6) return tierGait[tier];
  if (speed > .1) return slowGait[tier];
  return state === 'search' ? infectedSearch : infectedIdle;
}
/** Locomotion clips (their phase is driven by distance travelled). */
export const locomotionClips = new Set<string>(['infected-frail', 'infected-lurch', 'infected-sprint', 'infected-run', 'shamble', 'run', 'walk', 'npc-walk', 'npc-walk-relaxed', 'npc-carry', 'npc-cane', 'civ-flee']);
/** Wandering infected never jog upright: below run speed every tier lurches (frail shuffles), arms forward. */
const slowGait = { frail: clipOr('infected-frail', 'shamble'), average: clipOr('infected-lurch', 'shamble'), athletic: clipOr('infected-lurch', 'shamble') } as const;
const infectedIdle = clipOr('infected-idle', 'idle'), infectedSearch = clipOr('infected-search', 'idle');
/** One human crowd draw regardless of density; poses, veins, eyes and clothing vary per instance. */
class CivilianBatch extends Group {
  private readonly corpses = new StaticCorpses();
  private readonly probe = new CrowdFigureProbe();
  private locomotion!: CrowdLocomotion;
  private gunAim!: CrowdGunAim;
  private poses!: CrowdPosePalette;
  private mesh!: InstancedMesh;
  private releaseMaterial?: () => void;
  private bakedClip!: CrowdClip;
  private readonly hand = new Matrix4();
  private readonly gunDirection = new Vector3();
  private gripTriangles: Float32Array = new Float32Array();
  private gripReach = .07;
  private texture!: DataTexture;
  private readonly transform = new Matrix4();
  private readonly lean = new Matrix4().makeRotationZ(-.34);
  private readonly sway = new Matrix4();
  private readonly motion = new MotionPhase();
  private strideScale = 1;
  private readonly colors = civilianRoles.map(d => new Color(d.color));
  private readonly frame = new InstancedBufferAttribute(new Float32Array(350), 1).setUsage(StreamDrawUsage);
  private readonly tint = new InstancedBufferAttribute(new Float32Array(350 * 4), 4).setUsage(StreamDrawUsage);
  /** Infection overlay per instance: x skin blend toward ash-green, y eye glow, z blood (negative for a routine grip); w is the
   * displayed pose-atlas row. Packed so the draw stays within WebGPU's 8 vertex buffers (a separate `_pose_frame`
   * buffer made the pipeline invalid: every pedestrian vanished on WebGPU while props and shadows still drew). */
  private readonly overlay = new InstancedBufferAttribute(new Float32Array(350 * 4), 4).setUsage(StreamDrawUsage);
  private readonly shirt = new Color();
  private registry?: AssetRegistry;
  source = 'placeholder';
  /** lod2 = the far band; lod1 = the near band; lod0 = the few closest figures (CrowdVisibility heroes). */
  get distant(): boolean { return this.lod === 'lod2'; }
  constructor(readonly world: SimWorld, readonly model: string, readonly lod: 'lod0' | 'lod1' | 'lod2', private readonly visibility: CrowdVisibility, private readonly shading?: Materials, private readonly props?: RoutineProps, private readonly gait = new GaitPhase(), private readonly footwork = new CrowdFootwork(), private readonly moves = new InfectedMoves(), private readonly presentation = new MotionPresentation(crowdTurnRate)) { super(); this.name = 'civilian-crowd'; this.add(this.corpses); this.probe.lod = lod; }
  async init(): Promise<void> {
    await loadGate.foreground(); await loadGate.wait();
    let key: string | undefined = `${this.model}:${this.lod}`;
    const cached = preparedCrowds.get(key) ?? await loadCivilianBake(this.model, this.lod);
    let placeholder = false, model: Group;
    if (cached?.rig) model = cached.rig.clone(true);
    else {
      const loaded = await (this.registry ??= new AssetRegistry(() => {})).loadAsset(this.model, this.lod);
      placeholder = !!loaded.userData.placeholder; model = placeholder ? createCivilianPlaceholder() : loaded as Group;
      prepareCivilianRig(model, this.model, placeholder); if (placeholder) key = undefined;
    }
    this.source = placeholder ? 'placeholder' : 'glb';
    if (cached) for (const name of cached.clip.parts) if (!model.getObjectByName(name)) {
      const joint = model.clone(false); joint.name = name; joint.position.set(0, 0, 0); model.add(joint);
    }
    const baked = cached ? { ...cached, geometry: cached.geometry.clone(), shirtColor: cached.shirtColor?.clone() } : await prepareCivilianGeometry(model, this.model, this.distant, placeholder);
    this.gunAim = new CrowdGunAim(model, baked.clip.parts);
    this.strideScale = baked.strideScale;
    this.locomotion = new CrowdLocomotion(model, baked.clip, this.footwork); this.probe.sole = this.locomotion.sole;
    if (key) {
      preparedCrowds.delete(key);
      preparedCrowds.set(key, cached || { ...baked, geometry: baked.geometry.clone(), shirtColor: baked.shirtColor?.clone() });
      if (preparedCrowds.size > preparedCrowdLimit) {
        const oldest = preparedCrowds.keys().next().value!;
        preparedCrowds.get(oldest)!.geometry.dispose(); preparedCrowds.delete(oldest);
      }
    }
    this.gripTriangles = baked.gripTriangles!; this.gripReach = baked.gripReach!;
    baked.geometry.setAttribute('_clip_frame', this.frame); baked.geometry.setAttribute('_variant', this.tint); baked.geometry.setAttribute('_overlay', this.overlay);
    this.bakedClip = baked.clip;
    this.poses = new CrowdPosePalette(baked.clip, 350); this.texture = this.poses.texture;
    const shared = civilianMaterial(this.shading, baked.doubleSided, this.bakedClip.parts.indexOf('handR'), this.texture);
    const material = shared.material; this.releaseMaterial = shared.release;
    this.mesh = new InstancedMesh(baked.geometry, material, 350); this.mesh.userData.preRenderSolo = true; this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.castShadow = !this.distant; this.mesh.receiveShadow = true;
    this.mesh.instanceMatrix.setUsage(StreamDrawUsage);
    const matrices = new InstancedInterleavedBuffer(this.mesh.instanceMatrix.array, 16, 1).setUsage(StreamDrawUsage);
    for (let i = 0; i < 4; i++) baked.geometry.setAttribute(`_crowd${i}`, new InterleavedBufferAttribute(matrices, 4, i * 4));
    this.mesh.onBeforeRender = () => { shared.bindTexture(this.texture); matrices.version = this.mesh.instanceMatrix.version; matrices.clearUpdateRanges(); matrices.addUpdateRange(0, this.mesh.count * 16); };
    // The shared graph performs its full transform through geometry attributes.
    // Keep Three's instancing API, but omit its redundant implicit transform.
    Object.defineProperty(this.mesh, 'isInstancedMesh', { value: false, writable: true });
    this.mesh.userData.staticInstanceAttributes = true;
    this.mesh.userData.staticInstancePosition = material.positionNode;
    this.mesh.onAfterRender = () => this.probe.draw();
    // First settled bodies must not bake geometry or compile frozen-material shaders during the retreat.
    // Settled bodies are always placed through LOD1 below. LOD0/LOD2 never
    // populate these pages, so preparing them repeats the bake and node build.
    if (this.world.scenario === 'L6' && this.lod === 'lod1') this.corpses.prepare(this.model, baked.geometry, material, baked.clip, civilianClips.indexOf('death-back') * framesPerClip + framesPerClip - 1);
    this.add(this.mesh); if (placeholder) disposeCharacter(model); this.update();
  }
  update(alpha = 1, low = false, shotId?: number): void {
    this.probe.begin(); this.corpses.begin(id => this.world.entities.get(id));
    if (!this.mesh) return; let index = 0, shadowPixels = 0;
    const renderTick = Math.max(0, this.world.tick + alpha - 1);
    const shot = shotId === undefined ? undefined : this.world.entities.get(shotId);
    for (const e of shot ? [shot] : this.world.entities.iterate()) {
      if (index >= 350 && !e.corpse) continue;
      // Match once before projection: the other nineteen model/LOD batches
      // need no culling work for this person (or for ordinary infected).
      const c = e.civilian;
      const model = crowdModelOf(e);
      if (model !== this.model) continue;
      // Settled corpses become static instances once, wherever the camera is; they are never culled or LOD-switched.
      if (e.corpse) { if (this.lod === 'lod1' && !e.civilian && e.infected && keepsLook(e)) this.place(e, index, alpha); continue; }
      // Conservative animated bounds retain limbs, falling bodies and interpolated motion.
      if (shotId === undefined && !this.visibility.visible(e.transform.x, e.transform.y + .2, e.transform.z, 1.8)) continue;
      const pixels = this.visibility.pixels(e.transform.x, e.transform.y, e.transform.z, e.civilian?.adult === false ? 1.3 : 1.8);
      if ((shotId !== undefined && !this.visibility.visible(e.transform.x, e.transform.y + .2, e.transform.z, 1.8) ? 'lod1' : this.visibility.band(e.id, pixels, this.model)) !== this.lod) continue;
      if (!e.civilian && e.infected && keepsLook(e)) { if (this.place(e, index, alpha)) { index++; shadowPixels = Math.max(shadowPixels, pixels); } continue; }
      if (!c || c.pet || e.hidden || c.state === 'infected') continue;
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
      let clip: Clip = storyClip && c.state === 'calm' ? storyClip : annoyed ? 'stagger-left' : c.state === 'down' ? 'infection-collapse' : down ? 'death-side' : rising ? 'infection-rise' : c.state === 'bitten' ? 'infection-stagger' : c.state === 'grabbed' ? c.l1 ? civGrabbed : 'hurt' : startle ? civStartle : c.state === 'alarmed' ? noticingSeated && noticeElapsed < .6 ? 'npc-stand-up' : 'npc-look-around' : performing && activity?.activity !== 'walk' ? routineClip : speed > 2.5 ? c.l1 && c.state === 'flee' ? civFlee : 'run' : speed > .06 ? walkClip : c.schedule ? 'npc-look-around' : 'idle';
      if (speed > .06 && !strides[clip] && !down && !rising) clip = speed > 2.5 ? civFlee : walkClip;
      const duration = authoredClips.get(clip)!.duration, gaitDistance = Math.max(0, motion.distance - motion.speed * (1 - alpha) / 60);
      const phase = strides[clip] ? this.gait.sample(e.id, gaitDistance, clip, this.strideScale, speed) : annoyed ? Math.min(1, (this.world.tick - c.entered) / 24) : clip === 'npc-sit-down' || clip === 'npc-stand-up' ? Math.min(1, (noticingSeated ? noticeElapsed : elapsed) / .6) : c.state === 'down' || c.state === 'bitten' || rising ? Math.min(1, (this.world.tick - c.entered) / Math.max(1, c.until - c.entered)) : startle ? Math.min(civStartle === 'hurt' ? .5 : 1, (this.world.tick - c.entered) / Math.max(1, c.until - c.entered)) : down ? 1 : strides[clip] ? this.gait.sample(e.id, gaitDistance, clip, this.strideScale, motion.speed) : (renderTick / 60 + e.id * .137) / duration % 1;
      const storyElapsed = storyClip && clip === storyClip && !strides[clip] ? (this.world.tick - c.story!.start) / 60 / authoredClips.get(clip)!.duration : null;
      const storyFrame = storyElapsed === null ? null : loopingStory.has(clip) ? storyElapsed % 1 : Math.min(.999, storyElapsed);
      const presented = this.presentation.sample(e.id, e.transform, this.world.tick, alpha);
      // Convulsions while on the ground: a seeded body shudder that grows with the infection.
      this.transform.makeRotationY(presented.yaw + (down && c.state !== 'finished' ? Math.sin(this.world.tick * .9 + e.id) * Math.max(c.veins, e.infection ? .4 : 0) * (e.infection ? .09 : .012) : 0)); this.transform.setPosition(presented.x, presented.y - .7, presented.z);
      if ((performing || noticingSeated) && activity?.seat) {
        const seatBlend = noticingSeated ? Math.max(0, 1 - noticeElapsed / .6) : activity.activity === 'stand' ? Math.max(0, 1 - elapsed / .6) : Math.min(1, elapsed / .6);
        this.transform.setPosition(presented.x + (activity.seat.x - presented.x) * seatBlend, presented.y - .7 + (activity.seatLift ?? 0) * seatBlend, presented.z + (activity.seat.z - presented.z) * seatBlend);
      }
      let frame = civilianClips.indexOf(clip) * framesPerClip + (storyFrame ?? phase) * (framesPerClip - 1);
      const carried = e.appearance?.handProp;
      const handProp = (c.story ? c.story.prop : activity?.prop) ?? (carried ? carried as CivilianProp : c.ally?.gun ? c.ally.role === 'officer' ? 'pistol' : 'rifle' : undefined);
      const holding = !!handProp && c.state === 'calm' && !!this.props && !!(c.story || c.ally?.gun || e.appearance?.handProp !== null);
      const sourceFrame = frame;
      const blend = this.poses.sample(e.id, clip, frame, renderTick / 60);
      // The near batch is the pixel band: the courier's footwork there, stance plants or the baked clip further out.
      frame = this.locomotion.present(e.id, this.poses, frame, blend, clip, phase, this.transform, this.strideScale, speed, renderTick / 60, !this.distant);
      if (holding && !weaponProps.has(handProp!)) { frame = this.poses.correct(e.id, frame, ...blend, pose => uprightHand(pose, this.bakedClip.parts.indexOf('handR'), this.hand)); blend[0] = frame; blend[1] = 1; }
      const firing = this.props?.aiming.get(e.id);
      if (holding && ['pistol', 'rifle', 'hunting-rifle'].includes(handProp!) && (c.story?.clip === 'shoot' || firing && firing.until >= this.world.tick)) {
        // Only the torso/arm matrices change; the walking legs retain their heading and gait.
        if (firing && firing.until >= this.world.tick) this.gunDirection.set(firing.direction.x,firing.direction.y ?? 0,firing.direction.z).transformDirection(this.hand.copy(this.transform).invert());
        else this.gunDirection.set(1,0,0);
        frame = this.poses.correct(e.id, frame, ...blend, pose => this.gunAim.apply(pose,this.gunDirection)); blend[0] = frame; blend[1] = 1;
      }
      this.probe.add(e.id, clip, phase, this.transform, this.poses, frame, ...blend);
      this.mesh.setMatrixAt(index, this.transform); this.frame.setX(index, sourceFrame); this.overlay.setW(index, frame);
      if (holding) {
        const part = this.bakedClip.parts.indexOf('handR');
        this.poses.part(frame, ...blend, part, this.hand).premultiply(this.transform);
        this.props!.held(handProp!, this.hand, e.id, weaponProps.has(handProp!) ? undefined : this.gripTriangles, this.gripReach);
      }
      this.tintOf(e, index, blend[0] * 2 + blend[1]);
      const glow = c.eyesGlow ? e.infection ? Math.min(1, (this.world.tick - (e.infection.endsTick - 78)) / 30) : Math.min(1, Math.max(0, (c.veins - .12) / .65)) : 0;
      this.overlay.setXYZ(index, c.veins, Math.max(0, glow) + (e.infection ? 2 : 0), holding && !weaponProps.has(handProp!) ? -1 : e.infection ? Math.min(1, Math.max(0, (e.infection.progress - .35) / .4)) : 0); index++; shadowPixels = Math.max(shadowPixels, pixels);
    }
    if (shotId !== undefined) return; // The next render rebuilds the complete batch once.
    // Full sun silhouettes matter in the close game camera (high tier; low keeps the shared contact shadows). Wider views retain
    // the shared contact shadows; hysteresis prevents caster toggling at an edge.
    this.mesh.castShadow = !low && !this.distant && shadowPixels > (this.mesh.castShadow ? 128 : 156);
    this.mesh.count = index; this.mesh.visible = index > 0;
    if (index) {
      for (const attribute of [this.mesh.instanceMatrix, this.frame, this.tint, this.overlay]) {
        attribute.clearUpdateRanges(); attribute.addUpdateRange(0, index * attribute.itemSize); attribute.needsUpdate = true;
      }
    }
  }
  private tintOf(e: EntitySnapshot, index: number, blend: number): void {
    if (e.appearance) this.shirt.set(e.appearance.tint);
    else this.shirt.copy(this.colors[Math.max(0, civilianRoles.findIndex(d => d.variant === e.civilian?.variant))]);
    this.tint.setXYZW(index, this.shirt.r, this.shirt.g, this.shirt.b, blend);
  }
  /** A pedestrian who rose infected: same model and tint, full overlay, infected locomotion and fight clips. */
  private place(e: EntitySnapshot, index: number, alpha: number): boolean {
    const b = e.infected!, tick = this.world.tick;
    if (e.hidden || b.hidden) return false;
    if (e.corpse && this.corpses.has(e.id)) return false;
    // PO "skating": the sim publishes the actual post-collision ground motion every tick (AgentMotion) - use it, not a
    // per-batch sampler that goes stale when the figure crosses the near/far batch boundary.
    const motion = e.motion ?? this.motion.sample(e.id, tick, e.transform.x, e.transform.z), reaction = e.combat?.reaction, age = reaction ? (tick - reaction.started) / 60 : Infinity;
    let clip: Clip = infectedClip(b.state, motion.speed, e.appearance!.tier, tick < b.until);
    // Heavy reactions (deaths, finishers, blasts) knock the body down and get it up again; light hits flinch (InfectedMoves).
    const heavy = !!reaction?.heavy && tick < reaction.until && b.state !== 'dead';
    if (heavy) clip = age < .7 ? 'knockdown' : 'get-up';
    const duration = authoredClips.get(clip)!.duration, renderTick = Math.max(0, tick + alpha - 1);
    const phase = b.state === 'dead' ? (reaction?.groundDeath ? 1 : Math.min(1, (tick - b.deadAt) / 60 / duration)) - InfectedMoves.stir(e, renderTick, duration) : clip === 'windup' ? .5 : clip === 'get-up' ? Math.min(1, (age - .7) / getUpSpan(reaction!)) : heavy ? Math.min(1, age / .7) : strides[clip] ? this.gait.sample(e.id, Math.max(0, motion.distance - motion.speed * (1 - alpha) / 60), clip, this.strideScale, motion.speed) : (renderTick / 60 + e.id * .137) / duration % 1;
    const presented = this.presentation.sample(e.id, e.transform, tick, alpha);
    // Hunched silhouette: the whole body leans forward (pivot at the feet) on top of the tier gait's arms-forward pose.
    // QA2b: the read holds in every state - standing/searching infected sway and twitch on top of the hunch.
    const still = motion.speed <= .2 && b.state !== 'dead', t = tick / 60 + e.id * .71, near = !this.distant;
    const moving = !!strides[clip] && motion.speed > .06;
    const { layers, style } = this.moves.sample(e, b.state, b.until, (windups.get(e.archetype) ?? .5), renderTick, presented.yaw, motion.speed, moving ? clip : undefined);
    this.transform.makeRotationY(presented.yaw + (still ? Math.sin(t * 1.7) * .14 + (Math.sin(t * 7.3) > .93 ? .18 : 0) : 0));
    if (b.state !== 'dead' && !heavy && still) {
      // Near the camera the hunch bends at the hips over planted feet; far away the whole body leans from the feet.
      const lean = .34 + .14 + Math.abs(Math.sin(t * 2.3)) * .1, roll = (e.id % 2 ? .17 : -.17) + Math.sin(t * 1.3) * .04;
      if (near) { layers.lean = lean; layers.roll = roll; }
      else this.transform.multiply(this.lean).multiply(this.sway.makeRotationX(roll)).multiply(this.sway.makeRotationZ(-.14 - Math.abs(Math.sin(t * 2.3)) * .1));
    }
    this.transform.setPosition(presented.x, presented.y - .7, presented.z);
    let frame = civilianClips.indexOf(clip) * framesPerClip + phase * (framesPerClip - 1);
    const sourceFrame = frame;
    const blend = this.poses.sample(e.id, clip, frame, renderTick / 60);
    if (!e.corpse) frame = this.locomotion.present(e.id, this.poses, frame, blend, clip, phase, this.transform, this.strideScale, motion.speed, renderTick / 60, near, layers.lean || layers.lunge || layers.flinch || layers.lurch ? layers : undefined, style);
    if (e.corpse) {
      this.tintOf(e, index, 1);
      this.corpses.place(e, this.model, this.mesh.geometry, this.mesh.material as MeshLambertNodeMaterial, this.bakedClip, civilianClips.indexOf('death-back') * framesPerClip + framesPerClip - 1, this.transform, this.shirt, [.4, 0, 1]);
      return false;
    }
    this.probe.add(e.id, clip, phase, this.transform, this.poses, frame, ...blend);
    this.mesh.setMatrixAt(index, this.transform); this.frame.setX(index, sourceFrame); this.overlay.setW(index, frame);
    this.tintOf(e, index, blend[0] * 2 + blend[1]); this.overlay.setXYZ(index, .4, b.state === 'dead' && b.recoverAt < 0 ? 0 : 1, 1);
    return true;
  }
  snapshot() { return { instances: (this.mesh?.count ?? 0) + this.corpses.snapshot().instances, draws: (this.mesh?.count ? 1 : 0) + this.corpses.snapshot().draws, source: this.source, figures: [...this.probe.figures, ...this.corpses.snapshot().figures] }; }
  dispose(): void { this.corpses.dispose(); if (this.mesh) { this.mesh.geometry.dispose(); this.releaseMaterial?.(); this.mesh.dispose(); this.texture.dispose(); } void this.registry?.dispose(); this.clear(); }
}

/** Five civilian silhouettes share rigid-part LOD batches and the E07 clip path. */
export class CivilianCrowd extends Group {
  private readonly batches: CivilianBatch[];
  private readonly props: RoutineProps;
  private readonly visibility = new CrowdVisibility();
  private readonly gait = new GaitPhase();
  /** Fully solved footwork figures per frame: every close pedestrian on desktop, the closest few on phones. */
  private readonly footwork = new CrowdFootwork(48);
  private readonly moves = new InfectedMoves();
  /** Shared across the near/far batches so a figure crossing the band keeps its displayed turn. */
  private readonly presentation = new MotionPresentation(crowdTurnRate);
  private low = false;
  setQuality(tier: 'high' | 'low'): void { this.low = tier === 'low'; this.footwork.cap = this.low ? 16 : 48; }
  constructor(private readonly world: SimWorld, shading?: Materials) {
    super(); this.props = new RoutineProps(shading); this.add(this.props); this.shading=shading;
    // The L6 cast is fixed: bake it while briefing, before Mission.begin creates the people.
    const models=world.scenario==='L6'?[...new Set([...l6CastModels,...l1Pedestrians.models])]:coreCivilianModels;
    this.known.clear();for(const model of models)this.known.add(model);
    this.batches=models.flatMap(model=>[this.batch(model,'lod1'),this.batch(model,'lod2')]);this.add(...this.batches);
  }
  private readonly shading?: Materials;
  private batch(model: string, lod: 'lod0' | 'lod1' | 'lod2'): CivilianBatch { return new CivilianBatch(this.world, model, lod, this.visibility, this.shading, this.props, this.gait, this.footwork, this.moves, this.presentation); }
  /** PO P1 10-08 ("her mesh looks shredded/faceted up close"): the near band is the ~7k-triangle LOD1, so the few
   * figures that fill the screen (the CrowdView infected hero rule: > 196 px tall, 164 px to leave, at most 4, nearest
   * to the camera) draw the full LOD0 model. Its batch per model is loaded on first use (desktop tier only). */
  private readonly heroLoads = new Map<string, Promise<void>>();
  private selectHeroes(camera?: import('three').Camera): void { // camera = the LOD camera (game camera while a free camera inspects)
    const v = this.visibility, previous = new Set(v.heroes); v.heroes.clear();
    if (this.low || !camera) return;
    const picks: { id: number; model: string; d: number }[] = [];
    for (const e of this.world.entities.iterate()) {
      if (e.corpse || e.hidden || e.infected?.hidden || e.civilian?.pet || (e.health?.current ?? 1) <= 0) continue;
      const turned = !e.civilian && !!e.infected && keepsLook(e);
      if (!turned && (!e.civilian || e.civilian.state === 'infected')) continue;
      const model = crowdModelOf(e); if (!model || !v.visible(e.transform.x, e.transform.y + .2, e.transform.z, 1.8)) continue;
      const pixels = v.pixels(e.transform.x, e.transform.y, e.transform.z, e.civilian?.adult === false ? 1.3 : 1.8);
      if (pixels <= (previous.has(e.id) ? 164 : 196)) continue;
      picks.push({ id: e.id, model, d: Math.hypot(e.transform.x - camera.position.x, e.transform.y - camera.position.y, e.transform.z - camera.position.z) - (previous.has(e.id) ? .75 : 0) });
    }
    picks.sort((a, b) => a.d - b.d || a.id - b.id);
    for (const pick of picks.slice(0, 4)) {
      v.heroes.add(pick.id);
      this.loadHero(pick.model);
    }
  }
  /** Starts the LOD0 batch of a model once (the first hero of a model would otherwise hitch the frame it appears in). */
  private loadHero(model: string): void {
    if (this.low || this.heroLoads.has(model)) return;
    const hero = this.batch(model, 'lod0');
    this.heroLoads.set(model, hero.init().then(() => { if (this.disposed) { hero.dispose(); return; } this.batches.push(hero); this.add(hero); this.visibility.heroModels.add(model); }, () => {}));
  }
  private disposed = false;
  private readonly known = new Set<string>(coreCivilianModels);
  /** Registers lod1/lod2 batches for model ids first seen on an entity (data-driven, once per id). */
  private discover(): void {
    // Campaign people spawn at Begin. Their close tiers must be ready before
    // the card closes, including L2/L3 officers who first appear at mission start.
    if (/^L[1-6]$/.test(this.world.scenario ?? '')) for (const model of this.known) this.loadHero(model);
    for (const e of this.world.entities.iterate()) {
      const model = crowdModelOf(e);
      // L5's small, fixed cast includes the hidden survivors, lookout and wanderers.
      // Bake their close models before shader warm-up: meeting one during play must not parse/bake a rig.
      if (model && (e.civilian?.survivor || this.world.scenario === 'L5' && !e.corpse)) this.loadHero(model);
      if (!model || this.known.has(model) || !model.startsWith('npc.')) continue;
      this.known.add(model);
      const added = [this.batch(model, 'lod1'), this.batch(model, 'lod2')];
      this.heroLoads.set('discover:' + model, Promise.all(added.map(b => b.init())).then(() => { if (this.disposed) { added.forEach(b => b.dispose()); return; } this.batches.push(...added); this.add(...added); }, () => {}));
    }
  }
  /** Hero LOD0 batches still loading (screenshots and tests wait for them). */
  async ready(): Promise<void> { await Promise.all(this.heroLoads.values()); }
  async init(): Promise<void> {
    const started = performance.now();
    if (/^L[1-6]$/.test(this.world.scenario ?? '')) for (const model of this.known) this.loadHero(model);
    await Promise.all(this.batches.map(b => b.init()));
    // L4's fixed close cast uses the same loading barrier as L1/L6 preparation
    // in discover(); no first-use LOD0 bake/index/simplification during the war.
    if (this.world.scenario === 'L4') for (const model of [...l1Pedestrians.models, 'npc.national-guard']) this.loadHero(model);
    loadMeasure('view:civilian-crowd', started); this.update();
  }
  update(alpha = 1, camera?: import('three').Camera, lodCamera = camera): void { this.footwork.begin(Math.max(0, this.world.tick + alpha - 1) / 60); this.visibility.begin(camera, typeof innerHeight === 'number' ? innerHeight : 900, lodCamera); this.discover(); this.selectHeroes(lodCamera); this.props.begin(); for (const [id, pose] of this.props.aiming) if (pose.until < this.world.tick || !this.world.entities.get(id)) this.props.aiming.delete(id); this.batches.forEach(b=>b.update(alpha, this.low)); for (const e of this.world.entities.iterate()) if (e.droppedProp) this.props.dropped(e.droppedProp, e.transform); this.props.finish(); }
  snapshot() { const states=this.batches.map(b=>b.snapshot());return {instances:states.reduce((n,s)=>n+s.instances,0),draws:states.reduce((n,s)=>n+s.draws,0),figures:states.flatMap(s=>s.figures),muzzles: [...this.props.muzzles].map(([id, position]) => ({ id, position: position.toArray() })),source:states.every(s=>s.source==='glb')?'glb':'placeholder'}; }
  aimGun(id: number, direction: { x: number; y?: number; z: number }): void { this.props.aiming.set(id, { until: this.world.tick + 24, direction: { ...direction } }); }
  shotMuzzle(id: number, direction: { x: number; y?: number; z: number }): Vector3 | null {
    this.aimGun(id,direction);
    const entity = this.world.entities.get(id); if (!entity) return null;
    const model = crowdModelOf(entity);
    for (const batch of this.batches) if (batch.model === model) batch.update(1,this.low,id);
    return this.muzzle(id);
  }
  muzzle(id: number): Vector3 | null { return this.props.muzzles.get(id)?.clone() ?? null; }
  gunMeshes() { return this.props.guns.filter(g => (this.props.aiming.get(g.entity)?.until ?? -1) >= this.world.tick); }
  heldProps() { return this.props.contacts; }
  dispose(): void { this.disposed = true; this.props.dispose(); this.batches.forEach(b=>b.dispose());this.clear(); }
}
