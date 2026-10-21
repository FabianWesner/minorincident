import { dogCoats, dogCoat } from '../data/dogAppearance';
import { regularInfectedModels } from '../data/crowdAppearance';
import { resolveCrowdAppearance, crowdAppearanceColor, crowdShirt, markCrowdAppearance, writeCrowdAppearance, renderedCrowdLook, crowdVertexLayout, crowdHeadwearVisibility } from './characters/CrowdAppearance';
import type { CrowdAccessories } from './characters/CrowdAccessories';
import { SpatialHash } from '../sim/spatial/SpatialHash';
import { infectedContactDistance } from '../sim/ai/CharacterSeparation';
import { deinterleaveGeometry, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { CrowdVisibility } from './CrowdVisibility';
import { crowdModelKey, registerCrowdModel } from './crowdModels';
import { markInfectedEyeCores } from './characters/infectedEyes';
import { simplifyCrowdLod } from './characters/crowdLodGeometry';
import { crowdLod, canHoldCrowdPose } from './lodPolicy';
import { StaticCorpses } from './characters/StaticCorpses';
import { CrowdFootwork, CrowdLocomotion } from './characters/CrowdLocomotion';
import { InfectedMoves, getUpSpan } from './characters/InfectedMoves';
import { GaitPhase } from './characters/GaitPhase';
import { CrowdFigureProbe } from './characters/CrowdFigureProbe';
import { contactShadowMaterial } from './ContactShadows';
import { qualityBudgets, type QualityTier } from '../core/Quality';
// Adapted from Bruno Simon InstancedGroup.js (MIT, 41046b5), using E17 GPU crowdMatrix/clipTexture.
import { BoxGeometry, BufferGeometry, PlaneGeometry, Color, DoubleSide, FrontSide, Group, InstancedInterleavedBuffer, InterleavedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshLambertNodeMaterial, MeshBasicNodeMaterial, Frustum, Sphere, Vector3, StreamDrawUsage } from 'three/webgpu';
import { mix, attribute, mat4, normalGeometry, vec3, positionGeometry, vec4, float, cameraViewMatrix, luminance, screenCoordinate, uniform, sharedUniformGroup } from 'three/tsl';
import { crowdBlendedMatrix, packCrowdParts } from '../assets/crowd';
import type { Materials } from './Materials';
import { AssetRegistry } from '../assets/registry';
import manifest from '../assets/manifest.json' with { type: 'json' };
import { civilianRoles } from '../data/npcs';
import { infectedDefinitions } from '../data/infected';
import type { EntitySnapshot } from '../sim/world/types';
import { isOutbreakDistrict } from '../levels/districts/types';
import type { SimWorld } from '../sim/world/SimWorld';
import { createInfectedPlaceholder } from './characters/infectedPlaceholder';
import type { View } from './View';
import { bakeInfected, bakeInfectedAsync, framesPerClip, infectedClips } from './characters/bakeInfected';
import { loadGate } from '../assets/loadGate';
import { authoredClips, strides } from './characters/clips';
import { CrowdPosePalette } from './characters/CrowdPosePalette';
import { MotionPresentation, crowdTurnRate } from './characters/MotionPresentation';
import { MotionPhase } from './characters/MotionPhase';
import { loadMeasure } from '../assets/loadTiming';
import { keepsLook } from '../sim/outbreak/appearance';
import { alphaLook, alphaLooks } from '../data/alphaLooks';
interface Batch { animal: boolean; locomotion: CrowdLocomotion; probe: CrowdFigureProbe; poses: CrowdPosePalette; mesh: InstancedMesh; state: InterleavedBufferAttribute; tint: InterleavedBufferAttribute; shirt: Color; strideScale: number; windup: number; texture: import('three').DataTexture; count: number; placeholders: boolean; lod: string; role: string }
/** Simulation ticks a hit flash may last at most (Vfx pulses for 0.1 s = 6 ticks at 60 Hz). */
export const hitFlashTicks = 8;
/** One instanced, rigid-part GPU batch per archetype. Scene graph size never grows with infected population. */
/** E19 §5.4: the speed tier must read from the silhouette. Prefer the sim's tier,
 * else the brain's jittered run speed (frail 4.7, average 5.1, athletic 5.6 m/s). */
function tierGait(b: { speed?: number; tier?: string; l1?: { tier: string } }): 'infected-frail' | 'infected-lurch' | 'infected-sprint' {
  const tier = b.l1?.tier ?? b.tier, speed = b.speed ?? 5;
  if (tier === 'frail' || tier === 'athletic' || tier === 'average') return tier === 'frail' ? 'infected-frail' : tier === 'athletic' ? 'infected-sprint' : 'infected-lurch';
  return speed >= 5.35 ? 'infected-sprint' : speed >= 4.4 && speed < 4.92 ? 'infected-frail' : 'infected-lurch';
}
export class CrowdView extends Group {
  private readonly registry: AssetRegistry;
  private readonly definitions = new Map<string, { id: string; asset: string; windup: number; decay?: string }>();
  private readonly modelAliases = new Map<string, string>();
  private readonly loadedModels = new Set<string>();
  private readonly pending = new Map<string, Promise<void>>();
  private readonly heroSlots = new Map<string, InstancedMesh>();
  private readonly visibility = new CrowdVisibility();
  private readonly heroIds = new Set<number>();
  private readonly previousHeroes = new Set<number>();
  private readonly nearest: { id: number; distance: number; role: string }[] = [];
  private readonly nearBodies: { id: number; distance: number }[] = [];
  private readonly nearIds = new Set<number>();
  private readonly heroBands = new Map<number, boolean>();
  private readonly rolePixels = new Map<string, number>();
  private readonly roleLods = new Map<string, 'lod1' | 'lod2'>();
  private readonly frustum = new Frustum();
  private readonly projection = new Matrix4();
  private readonly bounds = new Sphere(new Vector3(), 1);
  private disposed = false;
  private readonly batches = new Map<string, Batch>();
  private readonly transform = new Matrix4();
  /** Displayed turn rate cap (rad/s): sim facing snaps become stepped turns. */
  private readonly presentation = new MotionPresentation(crowdTurnRate);
  private readonly motion = new MotionPhase();
  private readonly gait = new GaitPhase();
  /** Courier footwork for the infected inside the close pixel band (budgeted per frame; phones solve fewer). */
  private readonly footwork = new CrowdFootwork(40);
  private readonly footBands = new Map<number, 'lod1' | 'lod2'>();
  private readonly moves = new InfectedMoves();
  /** Corpses persist until a level/checkpoint resets their sim IDs. */
  private get corpseTicks(): number { return Infinity; }
  private readonly staticCorpses = new StaticCorpses();
  private readonly corpseGeometry = new Map<string, BufferGeometry>();
  private entityRevision = -1;
  private frozenRevision = -1;
  private readonly figures: EntitySnapshot[] = [];
  private readonly corpseSpatial = new SpatialHash();
  private readonly corpseNeighbors: number[] = [];
  private readonly corpseQuery = { x: 0, z: 0, r: 1.25 };
  private readonly corpses = new Map<number, { x: number; z: number; sourceX: number; sourceZ: number; deadAt: number }>();
  private readonly shadows: InstancedMesh;
  private readonly feedback = new Map<number, { mask: number; strength: number; at: number }>();
  private readonly caps = new InstancedMesh(new BoxGeometry(.18, .06, .18), new MeshBasicNodeMaterial({ color: '#b3121f' }), 1750);
  private goreEnabled = true;
  private cullDistance = 60;
  setQuality(tier: QualityTier): void { this.cullDistance = qualityBudgets[tier].cullDistance; this.low = tier === 'low'; this.footwork.cap = this.low ? 12 : 40; }
  private readonly logs: { id: string; reason: string }[] = [];
  constructor(private readonly world: SimWorld, private low = false, private readonly shading?: Materials, private readonly accessories?: CrowdAccessories) {
    super(); this.name = 'infected-crowd'; this.add(this.staticCorpses);
    this.caps.frustumCulled = false; this.caps.count = 0; this.add(this.caps);
    this.registry = new AssetRegistry((event) => this.logs.push(event));
    const shadow = new PlaneGeometry(1.2, 1.2); shadow.rotateX(-Math.PI / 2);
    this.shadows = new InstancedMesh(shadow, contactShadowMaterial(), 350); this.shadows.frustumCulled = false; this.shadows.count = 0; this.add(this.shadows);
  }
  async init(): Promise<void> {
    const started = performance.now();
    const variants = manifest.filter(a => (a.status === 'integrated' || a.status === 'final') && a.category === 'infected' && !infectedDefinitions.some(d => d.asset === a.id) && a.id !== 'inf.corpse-poses');
    const models = new Set([...this.world.entities.iterate()].flatMap(e => e.civilian?.schedule && !e.civilian.pet && e.civilian.model ? [e.civilian.model] : []));
    const animals = [...new Set([...this.world.entities.iterate()].flatMap(e => e.civilian?.zooAnimal ? [e.civilian.zooAnimal] : []))];
    const healthyDefinitions = animals.map(species => ({ ...infectedDefinitions.find(d => d.id === `infected.${species}`)!, id: `healthy.${species}`, asset: `amb.${species}` }));
    // Healthy amb.* assets are catalog props, so register their real rigs explicitly as animated crowds.
    const dogDefinitions = dogCoats.slice(1).map(coat => ({ ...infectedDefinitions.find(d => d.id === 'infected.dog')!, id: `inf.dog.${coat}`, decay: coat }));
    const allDefinitions = [...dogDefinitions, ...healthyDefinitions, ...[...models].map(model => ({ ...infectedDefinitions[0], id: model, asset: model })), ...infectedDefinitions, { ...infectedDefinitions[0], id: 'infected.patient-zero', asset: 'npc.patient-zero-courier' }, ...variants.map(a => ({ ...infectedDefinitions[0], id: a.id, asset: a.id }))];
    // L1 v2: every infected is a pedestrian that keeps its look and is drawn by the civilian crowd (lane D); this view
    // only needs the plain runner fallback plus scripted infected actors. Without the outbreak layer keep the old set.
    const regularCrowd = this.world.scenario === 'L7' || this.world.scenario?.startsWith('perf-horde-');
    const actors = Object.values(this.world.missions?.def.actors ?? {}).map(actor => actor.archetype);
    const l1Roles = new Set<string>(regularCrowd || this.world.scenario === 'L6' || this.world.npcs?.civilians.outbreak || this.world.districts?.districts.some(d => isOutbreakDistrict(d.id)) ? ['infected.runner', ...actors] : ['infected.runner', ...actors, ...civilianRoles.map(role => role.variant), ...models]);
    if (regularCrowd) for (const model of regularInfectedModels) l1Roles.add(model);
    for (const species of animals) { l1Roles.add(`healthy.${species}`); l1Roles.add(`infected.${species}`); }
    for (const entity of this.world.entities.iterate()) {
      // A future pet turn or another seeded spawn may use any coat of the same dog rig.
      if (entity.archetype === 'infected.dog' || entity.civilian?.pet === 'dog') l1Roles.add('inf.dog');
      if (!entity.infected) continue;
      l1Roles.add(entity.archetype);
      const model = entity.infected.model ?? entity.infected.variant;
      if (model) l1Roles.add(model);
    }
    // First Alphas emerge after the Fairhaven crowd has initialized. Warm the
    // derived model now, including its sim definition when A-S1 registers it.
    if (this.world.scenario === 'L4' || this.world.scenario === 'L5' || this.world.scenario === 'L7')
      for (const def of allDefinitions) if (alphaLooks['inf.alpha'].includes(def.asset)) l1Roles.add(def.id);
    const grove = this.world.scenario === 'L1' || this.world.scenario === 'L2' || this.world.scenario === 'L3' || this.world.scenario === 'L4' || this.world.scenario === 'L5' || this.world.scenario === 'L6';
    const definitions = grove || regularCrowd ? allDefinitions.filter(def => l1Roles.has(def.id) || l1Roles.has(def.asset)) : allDefinitions;
    for (const def of definitions) {
      // Registrations must not remove the asset spelling used by model overrides.
      const independent = def.id.startsWith('healthy.') || dogCoat(def.id);
      const key = independent ? def.id : registerCrowdModel(this.modelAliases, def);
      if (independent) this.modelAliases.set(def.id, key);
      this.definitions.set(key, def);
      if (!this.low) {
        const mesh = new InstancedMesh(new BufferGeometry(), this.shading?.shaded(vec3(1)) ?? new MeshBasicNodeMaterial(), 350);
        mesh.count = 0; mesh.visible = false; this.heroSlots.set(key, mesh); this.add(mesh);
      }
    }
    // Both tiers need a clean near silhouette; Alpha bodies and corpses retain the authored model.
    const lods: ('lod0' | 'lod1' | 'lod2')[] = !this.low && grove ? ['lod0', 'lod1', 'lod2'] : ['lod1', 'lod2'];
    // Resident infected can reach the close band immediately after a blast.
    // Bake their hero batches behind the loading card, rather than interrupting
    // play when the first survivor approaches. Low keeps a bounded near band.
    const residents = new Set<string>();
    for (const entity of this.world.entities.iterate()) {
      const role = entity.civilian?.zooAnimal ? `healthy.${entity.civilian.zooAnimal}` : entity.archetype;
      const variant = entity.infected?.model ?? entity.infected?.variant;
      const key = variant && this.modelAliases.get(variant) || this.modelAliases.get(role);
      if (key) residents.add(key);
    }
    await Promise.all(definitions.flatMap(def => {
      const warmHero = !this.low && !grove && residents.has(this.modelAliases.get(def.id)!);
      const alpha = (def.asset === 'inf.alpha' || def.asset === 'inf.mega-alpha') && residents.has(this.modelAliases.get(def.id)!);
      return [...new Set(warmHero || alpha ? ['lod0' as const, ...lods] : lods)].map(lod => this.loadBatch(def, lod));
    }));
    loadMeasure('view:infected-crowd', started);
    this.update();
  }
  private async loadBatch(def: { id: string; asset: string; windup: number; decay?: string }, lod: 'lod0' | 'lod1' | 'lod2'): Promise<void> {
      const key = crowdModelKey(def);
      const role = dogCoat(def.id) ? 'dog' : def.id.startsWith('infected.') ? def.id.slice(9) : 'runner', asset = def.asset;
      const loaded = await this.registry.loadAsset(asset, lod, def.decay) as Group;
      await loadGate.foreground(); await loadGate.wait(); // bakes wait for the level pick, then one per frame
      if (this.disposed) return;
      const healthy = def.id.startsWith('healthy.'), human = !dogCoat(def.id) && !/^(infected|healthy)\.(dog|cat|crow|lion|gorilla|elephant|zebra|flamingo)$/.test(def.id);
      const fallback = Boolean(loaded.userData.placeholder), model = fallback ? createInfectedPlaceholder(role) : loaded;
      const args = [model, this.registry.definition(asset).animatedNodes, role === 'crawler' && !fallback, undefined, fallback ? undefined : `${asset}${def.decay ? `.${def.decay}` : ''}:${lod}`] as const;
      const baked = this.world.scenario === 'L8' ? await bakeInfectedAsync(() => loadGate.wait(), ...args) : bakeInfected(...args), capacity = role === 'crow' ? 800 : 350;
      if (this.disposed) { baked.geometry.dispose(); return; }
      if (this.world.scenario === 'L8') { await loadGate.wait(); if (this.disposed) { baked.geometry.dispose(); return; } }
      const locomotion = new CrowdLocomotion(model, baked.clip, this.footwork);
      const probe = new CrowdFigureProbe(); probe.lod = lod; probe.sole = locomotion.sole; if (model.getObjectByName('legFL')) probe.animal(model);
      // Baking expands rigid parts to triangle soup. Index identical vertices before
      // instanced attributes are attached: same surfaces, fewer animated vertices.
      deinterleaveGeometry(baked.geometry);
      const indexed = mergeVertices(baked.geometry); baked.geometry.dispose(); baked.geometry = indexed;
      if (this.world.scenario === 'L8') { await loadGate.wait(); if (this.disposed) { baked.geometry.dispose(); return; } }
      if (!healthy) markInfectedEyeCores(baked.geometry);
      baked.geometry.userData.crowdLod = lod;
      const alpha = asset === 'inf.alpha' || asset === 'inf.mega-alpha';
      if (lod === 'lod2' && !fallback) {
        // Preserve colors, eyes, rigid-part ownership and each part's surface.
        await simplifyCrowdLod(baked.geometry, this.low ? .025 : .01, this.low ? (healthy ? .2 : .1) : .35, !healthy);
        if (this.disposed) { baked.geometry.dispose(); return; }
        if (!alpha) {
          // Ordinary settled bodies retain their surface without living figure detail.
          const corpse = baked.geometry.clone(); await simplifyCrowdLod(corpse, .04, .1, !healthy);
          if (this.disposed) { corpse.dispose(); baked.geometry.dispose(); return; }
          packCrowdParts(corpse); if (human) markCrowdAppearance(corpse, regularInfectedModels.some(id => id === asset));
          this.corpseGeometry.set(key, corpse);
        }
      }
      if (alpha && lod === 'lod0') {
        const corpse = baked.geometry.clone(); packCrowdParts(corpse);
        if (human) markCrowdAppearance(corpse, false);
        this.corpseGeometry.set(key, corpse);
      }
      if (this.world.scenario === 'L8') { await loadGate.wait(); if (this.disposed) { baked.geometry.dispose(); return; } }
      const poses = new CrowdPosePalette(baked.clip, capacity), texture = poses.texture;
      packCrowdParts(baked.geometry); if (human) markCrowdAppearance(baked.geometry, regularInfectedModels.some(id => id === asset));
      this.accessories?.registerSkull(asset, baked.geometry);
      const instanceData = new InstancedInterleavedBuffer(new Float32Array(capacity * 8), 8, 1).setUsage(StreamDrawUsage);
      const tint = new InterleavedBufferAttribute(instanceData, 4, 4);
      // Pack frame, detached leg, gore mask and flash into one slot: WebGL2 guarantees 16 attributes.
      const state = new InterleavedBufferAttribute(instanceData, 4, 0);
      baked.geometry.setAttribute('_state', state); baked.geometry.setAttribute('_variant', tint);
      const feedbackState = attribute('_state', 'vec4'), parts = attribute('_parts', 'vec4'), variant = attribute('_variant', 'vec4');
      const opacity = feedbackState.w.div(2).floor().div(255).oneMinus();
      const sourceColor = human ? crowdAppearanceColor(true) : attribute('color', 'vec3');
      // Keep the infected eye swatch out of the lit albedo. A bounded red
      // emitter avoids the pink centres from luminance-normalized swatches.
      const base = healthy ? mix(sourceColor, vec3(.26, .3, .22), feedbackState.z.mul(.4)) : mix(sourceColor, vec3(0), parts.z);
      const emission = healthy ? attribute('color', 'vec3').div(luminance(attribute('color', 'vec3')).max(.25)).mul(1.2) : vec3(3, .25, .22);
      // alpha-white: the hit flash brightens the figure's own colours (glow ~ albedo x strength, about x2 on a
      // night-lit body at the 0.45 peak), easing off on pale swatches (bone, teeth) so they do not clip to white.
      // A flat white add (0.45 on every channel, then bloom) turned the dark Alpha into a grey-white mass; any
      // white constant still dominates its near-black albedo.
      const glow = emission.mul(parts.z).add(feedbackState.w.mod(2).mul(base.mul(base.oneMinus().mul(1.1))));
      const material = this.shading?.shaded(base, glow, undefined, undefined, undefined, healthy ? undefined : parts.z) ?? Object.assign(new MeshLambertNodeMaterial({ vertexColors: false }), { colorNode: base, emissiveNode: glow });
      // E25 night readability: crowd silhouettes take the preset's moonlit rim.
      if ('figureRim' in material) { material.figureRim.value = .25; material.figureFill.value = 1; }
      // The Alpha-sized Mega retains its silhouette at contact, like a regular Alpha.
      // Instances cannot be sorted independently in the transparent render list.
      // A shared 4x4 screen-door threshold keeps every surface of a corpse at
      // a pixel together, unlike a 3D hash that exposes its deeper body parts.
      // Living actors keep every pixel; discarded pixels never write depth.
      const pixel = screenCoordinate.xy.floor();
      const bayer2 = (p: typeof pixel) => p.x.mod(2).mul(2).add(p.y.mod(2).mul(3)).mod(4);
      const threshold = bayer2(pixel).mul(4).add(bayer2(pixel.div(2).floor())).add(.5).div(16);
      material.maskNode = opacity.greaterThan(threshold);
      material.depthTest = material.depthWrite = true;
      material.side = baked.doubleSided ? DoubleSide : FrontSide;
      const outgoing = variant.w.div(2).floor(), weight = variant.w.mod(2);
      const matrix = crowdBlendedMatrix(texture, parts.x, feedbackState.x, outgoing, weight);
      // Part indices are uniforms, not shader constants: every archetype/LOD compiles to the same program (one shared
      // pipeline), only the uniform values differ. Missing parts get -1 and never match.
      // Rig part indices are immutable for this material. Upload them once;
      // they need no per-object uniform scan in every crowd and shadow draw.
      const rigParts = sharedUniformGroup('crowdParts');
      const part = parts.x, index = (name: string) => uniform(baked.clip.parts.indexOf(name)).setGroup(rigParts);
      let visible = part.equal(index('legL')).or(part.equal(index('shinL'))).or(part.equal(index('footL'))).select(feedbackState.y.oneMinus(), 1);
      const groups = [['armL', 'foreArmL', 'handL'], ['armR', 'foreArmR', 'handR'], ['legL', 'shinL', 'footL'], ['legR', 'shinR', 'footR'], ['head']];
      groups.forEach((names, bit) => {
        let hidden = float(0).equal(1);
        for (const name of names) hidden = hidden.or(part.equal(index(name)));
        const detached = feedbackState.z.div(2 ** bit).floor().mod(2);
        visible = hidden.select(visible.mul(detached.oneMinus()), visible);
      });
      const slot = lod === 'lod0' ? this.heroSlots.get(key) : undefined;
      const mesh = slot ?? new InstancedMesh(baked.geometry, material, capacity); mesh.userData.preRenderTextures = [texture];
      mesh.instanceMatrix.setUsage(StreamDrawUsage);
      if (slot) { mesh.geometry.dispose(); (mesh.material as MeshLambertNodeMaterial).dispose(); mesh.geometry = baked.geometry; mesh.material = material; this.heroSlots.delete(key); } mesh.userData.preRenderSolo = true; mesh.name = key; mesh.frustumCulled = false; mesh.count = 0;
      // E17's explicit instance * part transform order.
      const matrices = new InstancedInterleavedBuffer(mesh.instanceMatrix.array, 16, 1).setUsage(StreamDrawUsage);
      mesh.onBeforeRender = () => { matrices.version = mesh.instanceMatrix.version; matrices.clearUpdateRanges(); matrices.addUpdateRange(0, mesh.count * 16); };
      // Bind the current batch's matrices per draw, as CivilianCrowd does. Captured
      // buffer nodes can keep a retired LOD's GPU buffer in a shared shader state.
      for (let i = 0; i < 4; i++) baked.geometry.setAttribute(`_crowd${i}`, new InterleavedBufferAttribute(matrices, 4, i * 4));
      const column = (offset: number) => attribute(`_crowd${offset / 4}`, 'vec4');
      const instance = mat4(column(0), column(4), column(8), column(12));
      material.positionNode = instance.mul(matrix.mul(vec4(positionGeometry.mul(visible).mul(crowdHeadwearVisibility()), 1))).xyz;
      material.normalNode = instance.mul(matrix.mul(vec4(normalGeometry, 0))).xyz.transformDirection(cameraViewMatrix);
      Object.defineProperty(mesh, 'isInstancedMesh', { value: false, writable: true });
      mesh.userData.staticInstanceAttributes = true;
      mesh.userData.staticInstancePosition = material.positionNode;
      mesh.onAfterRender = () => probe.draw();
      this.batches.set(`${key}:${lod}`, { animal: !!model.getObjectByName('legFL'), locomotion, probe, poses, lod, role: key, mesh, state, tint, shirt: baked.shirtColor ?? new Color(1, 1, 1), strideScale: baked.strideScale, windup: def.windup, texture, count: 0, placeholders: fallback }); this.add(mesh);
      if (lod === 'lod1' || lod === 'lod2') this.loadedModels.add(key);
      // Ordinary deaths use the retained far surface; Alphas keep the authored body. Warm in
      // every combat scene so the first settled blast victims cannot link it
      // synchronously during play. Waiting for this batch also guarantees the
      // simplified corpse geometry exists before the loading draw.
      if (lod === (alpha ? 'lod0' : 'lod2')) {
        this.staticCorpses.prepare(`${key}:death-back:0`, this.corpseGeometry.get(key) ?? mesh.geometry, material, baked.clip, infectedClips.indexOf('death-back') * framesPerClip + framesPerClip - 1);
      }
      if (fallback) model.traverse((n) => { if (n instanceof Mesh) { n.geometry.dispose(); for (const m of Array.isArray(n.material) ? n.material : [n.material]) m.dispose(); } });
  }
  private modelKey(id: string): string | undefined {
    const key = this.modelAliases.get(id);
    return key && this.loadedModels.has(key) ? key : undefined;
  }
  /** PO #23: an Alpha drawn with its default model takes one of the sibling looks, chosen by entity id (same rig and size). An explicit model override keeps its asset. */
  private alphaKey(key: string, e: { id: number; infected?: { model?: string; variant?: string } }): string {
    // Naming the shipped asset on purpose (Scene Lab `look.model`, probes) keeps that exact look; the role default and the sim's Mega vary.
    if (e.infected?.model || e.infected?.variant === 'inf.alpha') return key;
    const look = alphaLook(key, e.id);
    return look !== key && this.modelKey(look) === look ? look : key;
  }
  async ready(): Promise<void> { await Promise.all(this.pending.values()); }
  update(view?: View, alpha = 1): void {
    this.deadFeet.clear(); this.staticCorpses.begin(id => this.world.entities.get(id));
    // Membership changes cover pooled ID reuse, checkpoint restore and streamed unload.
    // Frozen figures stay in StaticCorpses; the animated passes need only the rest.
    if (this.entityRevision !== this.world.entities.revision || this.frozenRevision !== this.staticCorpses.revision) {
      this.figures.length = 0;
      for (const e of this.world.entities.iterate()) if (!e.corpse || !this.staticCorpses.has(e.id)) this.figures.push(e);
      for (const [id] of this.corpses) if (!this.world.entities.get(id)?.infected || this.world.entities.get(id)!.health.current > 0) { this.corpses.delete(id); this.corpseSpatial.delete(id); }
      this.entityRevision = this.world.entities.revision; this.frozenRevision = this.staticCorpses.revision;
    }
    for (const batch of this.batches.values()) { batch.count = 0; batch.probe.begin(); }
    this.footwork.begin(Math.max(0, this.world.tick + alpha - 1) / 60);
    this.shadows.count = 0; this.caps.count = 0;
    for (const [id, feedback] of this.feedback) { const e = this.world.entities.get(id); if (!e?.combat || e.hidden || e.infected?.hidden) this.feedback.delete(id); else if (e.health.current > 0) feedback.mask = 0; }
    const player = this.world.entities.get(1)!;
    const focus = view?.cameraTarget ?? player.transform;
    if (view) this.frustum.setFromProjectionMatrix(this.projection.multiplyMatrices(view.camera.projectionMatrix, view.camera.matrixWorldInverse));
    this.visibility.begin(view?.camera, typeof innerHeight === 'number' ? innerHeight : 900, view?.lodCamera);
    const heroes = this.heroIds; this.previousHeroes.clear();
    for (const id of heroes) this.previousHeroes.add(id);
    heroes.clear(); this.nearest.length = 0; this.rolePixels.clear(); this.nearBodies.length = 0; this.nearIds.clear();
    for (const e of this.figures) {
      if (e.faction !== 'infected' && !e.civilian?.zooAnimal || !e.combat || e.hidden || e.infected?.hidden || e.archetype === 'infected.crow' || e.corpse || keepsLook(e)) continue;
      if (e.health.current <= 0 && this.world.tick - (e.infected?.deadAt ?? 0) >= this.corpseTicks) continue;
      const distance = Math.hypot(e.transform.x - focus.x, e.transform.z - focus.z);
      if (distance > this.cullDistance) continue;
      const variant = e.infected?.model ?? e.infected?.variant;
      const role = this.modelKey(e.civilian?.zooAnimal ? `healthy.${e.civilian.zooAnimal}` : e.archetype) ?? this.modelKey('infected.runner')!;
      const key = this.alphaKey((variant && this.modelKey(variant)) || role, e);
      const d = this.registry.definition(this.definitions.get(key)!.asset).dimensions;
      if (!this.visibility.visible(e.transform.x, e.transform.y - .7 + d.y / 2, e.transform.z, Math.hypot(d.x, d.y, d.z) / 2 + .75)) continue;
      const pixels = this.visibility.pixels(e.transform.x, e.transform.y, e.transform.z, d.y);
      this.rolePixels.set(key, Math.max(this.rolePixels.get(key) ?? 0, pixels));
      if (this.low && crowdLod(pixels, this.footBands.get(e.id)) === 'lod1') this.nearBodies.push({ id: e.id, distance });
      if (this.low && !/infected\.(alpha|mega-alpha)/.test(e.archetype)) continue;
      if (distance > (this.previousHeroes.has(e.id) ? 13 : 12)) continue;
      const hero = !view || pixels > (this.heroBands.get(e.id) ? 164 : 196);
      this.heroBands.set(e.id, hero); if (!hero) continue;
      // Hold an existing hero until a replacement is clearly closer.
      const score = distance - (this.previousHeroes.has(e.id) ? .75 : 0);
      let at = 0; while (at < this.nearest.length && this.nearest[at].distance <= score) at++;
      if (at < 8) { this.nearest.splice(at, 0, { id: e.id, distance: score, role: key }); if (this.nearest.length > 8) this.nearest.pop(); }
    }
    // Bound phone geometry while retaining near detail for the closest sixteen bodies.
    this.nearBodies.sort((a, b) => a.distance - b.distance || a.id - b.id);
    for (const body of this.nearBodies.slice(0, 16)) this.nearIds.add(body.id);
    // One background tier per role protects the largest visible silhouette and
    // avoids a third active draw for every archetype in a mixed horde.
    for (const [role, pixels] of this.rolePixels) this.roleLods.set(role, crowdLod(pixels, this.roleLods.get(role)));
    // Variant batches consume the same E07 draw budget as archetypes. Keep the four fixed effects in reserve;
    // dense mixed hordes use LOD1 instead of adding an extra LOD0 draw for every near model.
    const heroRoles = new Set<string>(), heroDrawBudget = Math.max(0, 30 - 4 - this.rolePixels.size);
    for (const e of this.nearest) if (heroRoles.has(e.role) || heroRoles.size < heroDrawBudget) { heroes.add(e.id); heroRoles.add(e.role); }
    for (const e of this.figures) {
      if (e.health.current > 0 && this.corpses.delete(e.id)) this.corpseSpatial.delete(e.id);
      if (e.id === 1 || e.faction !== 'infected' && !e.civilian?.zooAnimal || !e.combat) continue;
      if (e.corpse && this.staticCorpses.has(e.id)) continue;
      const distance = Math.hypot(e.transform.x - focus.x, e.transform.z - focus.z);
      if (e.hidden || e.infected?.hidden || !view && distance > this.cullDistance && !e.corpse || e.infected?.state === 'dead' && this.world.tick - e.infected.deadAt > this.corpseTicks) continue;
      // L1 v2: a pedestrian who turned keeps its own body and clothes (NpcView's civilian crowd); only the contact shadow is drawn here.
      if (keepsLook(e)) { if (!e.corpse && this.shadows.count < 350) { this.transform.makeTranslation(e.transform.x, (this.world.districts?.groundHeight(e.transform.x, e.transform.z) ?? 0) + .018, e.transform.z); this.shadows.setMatrixAt(this.shadows.count++, this.transform); } continue; }
      const availableLod = 'lod1';
      const role = this.modelKey(e.civilian?.zooAnimal ? `healthy.${e.civilian.zooAnimal}` : e.archetype) ?? this.modelKey('infected.runner')!;
      const variant = e.infected?.model ?? e.infected?.variant;
      const key = this.alphaKey((variant && this.modelKey(variant)) || role, e);
      const def = this.definitions.get(key)!;
      const dimensions = this.registry.definition(def.asset).dimensions;
      this.bounds.center.set(e.transform.x, e.transform.y - .7 + dimensions.y / 2, e.transform.z);
      this.bounds.radius = Math.hypot(dimensions.x, dimensions.y, dimensions.z) / 2 + .75;
      if (e.archetype === 'infected.crow' && e.infected) for (let bird = 0; bird < 20; bird++) {
        if (!e.infected.birdAlive[bird] && !((e.infected.birdDeadMask ?? 0) & 1 << bird)) continue;
        const p = e.infected.birdPositions;
        this.bounds.radius = Math.max(this.bounds.radius, Math.hypot(p[bird * 3] - this.bounds.center.x, p[bird * 3 + 1] - this.bounds.center.y, p[bird * 3 + 2] - this.bounds.center.z) + .5);
      }
      if (view && !e.corpse && !this.frustum.intersectsSphere(this.bounds)) continue;
      let lod: 'lod0' | 'lod1' | 'lod2' = this.low ? this.nearIds.has(e.id) ? 'lod1' : 'lod2' : e.health.current <= 0 || (this.world.infected?.active.length ?? 0) >= 100 ? 'lod2' : this.roleLods.get(key) ?? 'lod2';
      if (heroes.has(e.id) || e.corpse && (def.asset === 'inf.alpha' || def.asset === 'inf.mega-alpha')) {
        if (this.batches.has(`${key}:lod0`)) lod = 'lod0';
        else if (!this.pending.has(key)) {
          this.pending.set(key, this.loadBatch(def, 'lod0').finally(() => this.pending.delete(key)));
        }
      }
      // Quality changes/streaming may not have the requested tier yet. Keep the loaded figure.
      const batch = this.batches.get(`${key}:${lod}`) ?? this.batches.get(`${key}:${availableLod}`) ?? this.batches.get(`${key}:lod2`) ?? this.batches.get(`${key}:lod1`);
      if (!batch) continue;
      const b = e.infected ?? { state: e.health.current <= 0 || e.civilian?.state === 'finished' ? 'dead' : e.combat.attacking ? 'attack' : 'idle', until: 0, deadAt: e.civilian?.entered ?? 0, legLost: false, special: '', detached: false, variant: '', birdAlive: [], birdPositions: [], dx: 0, dz: 0 };
      const specialAttack = e.infected?.specialAttack;
      const physical = specialAttack && (e.infected?.pursuit && specialAttack.move === 'alpha.grab-throw' || ['alpha.charge', 'alpha.ground-slam', 'lion.pounce', 'lion.flank', 'gorilla.pound', 'gorilla.roar', 'elephant.charge', 'elephant.swipe', 'zebra.stampede'].includes(specialAttack.move)) ? specialAttack : undefined;
      const feedback = this.feedback.get(e.id);
      const renderTick = Math.max(0, this.world.tick + alpha - 1);
      const tick = distance > 35 ? Math.floor(this.world.tick / 2) * 2 : this.world.tick;
      const motion = e.motion ?? this.motion.sample(e.id, tick, e.transform.x, e.transform.z), gaitDistance = Math.max(0, motion.distance - motion.speed * (1 - alpha) / 60), reaction = e.combat.reaction;
      const age = reaction ? (this.world.tick - reaction.started) / 60 : Infinity;
      const death = e.archetype === 'infected.crawler' ? 'death-side' : 'death-back';
      let clip: typeof infectedClips[number] = b.state === 'dead' ? death : (b.legLost || e.archetype === 'infected.crawler') && motion.speed <= .06 ? 'crawl' : b.state === 'attack' && motion.speed <= .06 ? this.world.tick < b.until ? 'windup' : 'swing' : motion.speed > 2 ? tierGait(b as { speed?: number; tier?: string; l1?: { tier: string } }) : motion.speed > .06 ? 'shamble' : (b.state as string) === 'search' || (b.state as string) === 'attracted' ? 'infected-search' : 'infected-idle';
      // Heavy reactions (deaths, finishers, kicks, blasts) knock down and get up, also while knocked back; light hits only flinch (InfectedMoves).
      const heavy = !!reaction?.heavy && tick < reaction.until && b.state !== 'dead';
      if (heavy) clip = age < .48 ? reaction!.index % 2 ? 'knockdown' : 'flung' : age < .7 ? 'knockdown' : 'get-up';
      if (physical?.stage === 'telegraph') clip = 'windup';
      else if ((physical?.move === 'alpha.ground-slam' || physical?.move === 'gorilla.pound') && physical.stage === 'recovery') clip = 'swing';
      else if (physical?.move === 'elephant.swipe' && physical.stage === 'recovery') clip = 'swing';
      if (e.civilian?.zooAnimal) clip = e.civilian.state === 'finished' ? death : e.infection ? 'idle' : motion.speed > .06 ? 'walk' : 'idle';
      if (e.infectionRise) clip = 'infection-rise';
      if (b.special === 'dive') clip = 'run';
      // E32 dog: authored gallop while it runs, authored gather / spring / snap during the pounce (telegraph = the gather).
      const dogPounce = e.archetype === 'infected.dog' && b.state === 'attack' && !heavy && !e.infectionRise;
      if (e.archetype === 'infected.dog' && b.state !== 'dead' && !heavy && !e.infectionRise) { if (dogPounce) clip = 'dog-lunge-bite'; else if (motion.speed > 3) clip = 'dog-gallop'; }
      if (e.infected?.specialAttack?.stage === 'telegraph') clip = 'windup';
      if (specialAttack?.move === 'zebra.kick') clip = 'zebra-rear-kick';
      if (specialAttack?.move === 'zebra.stampede' && specialAttack.stage === 'active') clip = 'zebra-stampede';
      if (specialAttack?.move === 'flamingo.dive' && specialAttack.stage === 'active') clip = 'run';
      const duration = authoredClips.get(clip)?.duration ?? 1;
      const dogWindupTicks = Math.ceil(batch.windup * 60), dogBiteT = renderTick - (b.until - dogWindupTicks);
      const phase = clip === 'dog-lunge-bite' ? Math.max(0, Math.min(1, dogBiteT < dogWindupTicks ? .4 * dogBiteT / dogWindupTicks : .4 + .6 * (dogBiteT - dogWindupTicks) / 24)) : clip === 'zebra-rear-kick' && specialAttack ? Math.min(1, (renderTick - specialAttack.startTick) / (specialAttack.activeTick - specialAttack.startTick + 36)) : clip === 'zebra-stampede' && specialAttack ? .5 + ((renderTick - specialAttack.activeTick) / 32 % 1) / 3 : e.infectionRise ? Math.min(1, (this.world.tick - e.infectionRise.started) / (e.infectionRise.until - e.infectionRise.started)) : b.state === 'dead' ? (reaction?.groundDeath ? 1 : Math.min(1, (this.world.tick - b.deadAt) / 60 / duration)) - InfectedMoves.stir(e, renderTick, duration) : clip === 'windup' ? e.infected?.specialAttack ? Math.min(1, (renderTick - e.infected.specialAttack.startTick) / (e.infected.specialAttack.activeTick - e.infected.specialAttack.startTick)) : Math.max(0, Math.min(1, 1 - (b.until - this.world.tick) / (batch.windup * 60))) : reaction && clip === 'get-up' ? Math.min(1, (age - .7) / getUpSpan(reaction)) : reaction && ['flung', 'knockdown', 'stagger-left', 'stagger-right'].includes(clip) ? Math.min(1, age / (reaction.heavy ? .48 : (reaction.until - reaction.started) / 60)) : strides[clip] ? this.gait.sample(e.id, gaitDistance, batch.animal ? clip === 'dog-gallop' ? 'corgi-gallop' : 'corgi-trot' : clip, batch.strideScale, motion.speed) : (renderTick / 60 + e.id * .137) / duration % 1;
      let frame = infectedClips.indexOf(clip) * framesPerClip + phase * (framesPerClip - 1);
      const tint = batch.animal ? batch.shirt : crowdShirt(e.id);
      const presented = this.presentation.sample(e.id, e.transform, this.world.tick, alpha);
      const resting = b.state === 'dead' ? this.corpsePosition(e, b.deadAt) : e.transform;
      const settle = b.state === 'dead' ? reaction?.groundDeath ? 1 : Math.min(1, (this.world.tick - b.deadAt) / 60) : 0;
      const x = presented.x + (resting.x - e.transform.x) * settle, z = presented.z + (resting.z - e.transform.z) * settle;
      const blend = batch.poses.sample(e.id, clip, frame, renderTick / 60);
      const fade = 0;
      if (e.archetype === 'infected.crow') {
        for (let bird = 0; bird < 20; bird++) if ((e.infected?.birdDeadMask ?? 0) & 1 << bird) {
          const x = b.birdPositions[bird * 3], z = b.birdPositions[bird * 3 + 2]; this.transform.makeTranslation(x, this.world.districts?.groundHeight(x, z) ?? 0, z);
          this.staticCorpses.place(e, `${key}:bird`, batch.mesh.geometry, batch.mesh.material as MeshLambertNodeMaterial, batch.poses.clip, infectedClips.indexOf('death-back') * framesPerClip + framesPerClip - 1, this.transform, tint, [0, 0, 0], `${e.id}/${bird}`);
        }
        for (let bird = 0; bird < 20; bird++) if (b.birdAlive[bird]) { this.transform.makeTranslation(b.birdPositions[bird * 3], b.birdPositions[bird * 3 + 1], b.birdPositions[bird * 3 + 2]); batch.mesh.setMatrixAt(batch.count, this.transform); writeCrowdAppearance(batch.tint, batch.count, e.id, tint, blend[0] * 2 + blend[1], this.accessories?.slot(e), this.accessories?.hidesHair(e, batch.lod)); batch.state.setXYZW(batch.count++, frame, 0, 0, this.flashStrength(e, feedback)); }
      } else {
        this.transform.makeRotationY(presented.yaw + (e.civilian?.zooAnimal && e.infection ? Math.sin(renderTick * .5 + e.id) * .018 * e.infection.progress : 0)); this.transform.setPosition(x, (b.state === 'dead' ? this.world.districts?.supportBelow(x, z, e.transform.y - .7) ?? 0 : Math.max(presented.y - 0.7, this.world.districts?.pavingHeight(x, z) ?? 0)) + (reaction?.heavy && age < .48 ? Math.max(0, .16 * (1 - Math.abs(age / .24 - 1))) : 0), z);
        if (b.state === 'dead') this.deadFeet.set(e.id, { id: e.id, x, y: this.transform.elements[13], z });
        if (e.corpse) {
          const mask = (feedback?.mask ?? 0) | (b.detached && this.goreEnabled ? 4 : 0);
          const hiddenParts = [['armL', 'foreArmL', 'handL'], ['armR', 'foreArmR', 'handR'], ['legL', 'shinL', 'footL'], ['legR', 'shinR', 'footR'], ['head']].flatMap((parts, bit) => mask & 1 << bit ? parts : []);
          const look = resolveCrowdAppearance(e), source = this.corpseGeometry.get(key) ?? batch.mesh.geometry;
          const frozenSource = !batch.animal ? this.accessories?.corpseSource(e, source, def.asset, batch.poses.clip.parts.indexOf('head')) ?? source : source;
          this.staticCorpses.place(e, `${key}:${death}:${mask}`, frozenSource, batch.mesh.material as MeshLambertNodeMaterial, batch.poses.clip, infectedClips.indexOf(death) * framesPerClip + framesPerClip - 1, this.transform, tint, [0, 0, 0], String(e.id), hiddenParts, !batch.animal ? look : undefined);
          continue;
        }
        // Close pixel band (hysteresis): the courier's footwork plus the zombie move set; further out stance plants only.
        const band = crowdLod(this.visibility.pixels(e.transform.x, e.transform.y, e.transform.z, dimensions.y), this.footBands.get(e.id)); this.footBands.set(e.id, band);
        const crawling = b.legLost || e.archetype === 'infected.crawler' || clip === 'crawl', moving = !!strides[clip] && motion.speed > .06;
        const { layers, style } = this.moves.sample(e, b.state, b.until, batch.windup, renderTick, presented.yaw, motion.speed, moving ? clip : undefined);
        // The baked hunch already reaches toward the victim. Keep the added pelvis/torso lunge
        // inside the reserved contact space; distant windups retain their full coil and extension.
        const target = this.world.entities.get(e.infected?.heardTargetId || e.infected?.l1?.targetId || 1);
        if (target?.survivor && Math.hypot(x - target.transform.x, z - target.transform.z) < infectedContactDistance(e.combat!.radius) + .15) layers.lunge = Math.min(layers.lunge ?? 0, .04);
        if (!heavy && !specialAttack && b.state !== 'dead' && this.world.solids?.clear(e.transform, e.combat!.radius + .6, e.id) === false) {
          // Keep the baked attack hunch over its planted feet at a hull, wall or body.
          // Combat reach is unchanged; only the added forward body throw yields.
          layers.lunge = Math.min(layers.lunge ?? 0, 0); layers.lean = -.25; layers.lurch = 0;
        }
        const layered = !crawling && (layers.lean || layers.lunge || layers.flinch || layers.lurch || layers.chestBeat || layers.trunkSwipe || layers.throwPose) ? layers : undefined;
        // Zoomed-out encounters retain planted feet inside the same 12 m action range; the footwork cap is unchanged.
        frame = batch.locomotion.present(e.id, batch.poses, frame, blend, clip, phase, this.transform, batch.strideScale, motion.speed, renderTick / 60, (band === 'lod1' || distance <= 12 || !moving || !!specialAttack || !!e.infected?.roar) && !crawling, layered, style, true, this.low && canHoldCrowdPose(e, this.world.tick) ? 2 : 1);
        if (!batch.animal) this.accessories?.place(e, batch.lod as 'lod0' | 'lod1' | 'lod2', batch.poses, frame, blend, this.transform, !!((feedback?.mask ?? 0) & 16));
        batch.probe.add(e.id, clip, phase, this.transform, batch.poses, frame, ...blend, batch.mesh.geometry);
        const figure = batch.probe.figures.at(-1);
        if (figure?.id === e.id && !batch.animal && !e.civilian?.zooAnimal) figure.appearance = renderedCrowdLook(e.id, this.definitions.get(key)!.asset, batch.mesh.geometry, tint, this.accessories?.drawnSlot(e, batch.lod as 'lod0' | 'lod1' | 'lod2') ?? null);
        batch.mesh.setMatrixAt(batch.count, this.transform); writeCrowdAppearance(batch.tint, batch.count, e.id, tint, blend[0] * 2 + blend[1], this.accessories?.slot(e), this.accessories?.hidesHair(e, batch.lod)); batch.state.setXYZW(batch.count++, frame, Number(b.detached && this.goreEnabled), e.civilian?.zooAnimal ? e.infection?.progress ?? 0 : feedback?.mask ?? 0, this.flashStrength(e, feedback) + Math.round(fade * 255) * 2);
        for (let limb = 0; limb < 5; limb++) if ((feedback?.mask ?? 0) & (1 << limb)) { const p = this.limbPosition(e.id, limb)!; this.transform.makeRotationY(e.transform.yaw); this.transform.setPosition(p.x, p.y + (limb === 4 ? -.17 : .18), p.z); this.caps.setMatrixAt(this.caps.count++, this.transform); }
      }
      if (e.archetype !== 'infected.crow') { this.transform.makeTranslation(e.transform.x, (this.world.districts?.groundHeight(e.transform.x, e.transform.z) ?? 0) + .018, e.transform.z); this.shadows.setMatrixAt(this.shadows.count++, this.transform); }
      // Attack ground warnings belong to Vfx: one pooled decal per attack.
    }
    for (const batch of this.batches.values()) {
      batch.mesh.count = batch.count; batch.mesh.visible = batch.count > 0;
      if (batch.count) {
        batch.mesh.instanceMatrix.clearUpdateRanges(); batch.mesh.instanceMatrix.addUpdateRange(0, batch.count * 16); batch.mesh.instanceMatrix.needsUpdate = true;
        const data = batch.state.data;
        data.clearUpdateRanges(); data.addUpdateRange(0, batch.count * data.stride); data.needsUpdate = true;
      }
    }
    this.caps.visible = this.caps.count > 0; this.shadows.visible = this.shadows.count > 0;
    if (this.caps.count) { this.caps.instanceMatrix.clearUpdateRanges(); this.caps.instanceMatrix.addUpdateRange(0, this.caps.count * 16); this.caps.instanceMatrix.needsUpdate = true; }
    if (this.shadows.count) { this.shadows.instanceMatrix.clearUpdateRanges(); this.shadows.instanceMatrix.addUpdateRange(0, this.shadows.count * 16); this.shadows.instanceMatrix.needsUpdate = true; }
  }
  /** Scene Lab probe: frozen corpses as drawn (feet position). */
  private readonly deadFeet = new Map<number, { id: number; x: number; y: number; z: number }>();
  drawnCorpses(): { id: number; x: number; y: number; z: number }[] { const frozen = this.staticCorpses.drawn(), ids = new Set(frozen.map(c => c.id)); return [...frozen, ...[...this.deadFeet.values()].filter(c => !ids.has(c.id) && (this.world.entities.get(c.id)?.health.current ?? 1) <= 0)]; }
  /** Keep settled bodies on clear ground, giving each a readable footprint.
   * This is presentation only; damage and revive continue to use sim transforms. */
  private corpsePosition(e: EntitySnapshot, deadAtTick: number) {
    if (e.corpseThrown) return e.transform;
    const deadAt = deadAtTick, previous = this.corpses.get(e.id);
    if (previous?.deadAt === deadAt && previous.sourceX === e.transform.x && previous.sourceZ === e.transform.z) return previous;
    const pose = { x: e.transform.x, z: e.transform.z, sourceX: e.transform.x, sourceZ: e.transform.z, deadAt };
    // The body lies ~0.9 m behind its hips (death poses fall backwards): that strip must be clear too, so a
    // corpse never lies through a fence or wall (PO #14).
    const bx = -Math.cos(e.transform.yaw), bz = Math.sin(e.transform.yaw), nav = this.world.infected?.nav;
    // A body never lies half off the deck/ramp it died on: head and hips stay on the support the sim settled it on.
    const feet = e.transform.y - .7, districts = this.world.districts, level = (x: number, z: number) => !districts || Math.abs(districts.supportBelow(x, z, feet) - feet) <= .3;
    const separated = (x: number, z: number) => {
      this.corpseQuery.x = x; this.corpseQuery.z = z;
      this.corpseSpatial.query(this.corpseQuery, this.corpseNeighbors, false);
      for (const id of this.corpseNeighbors) {
        const p = this.corpses.get(id)!;
        if (id !== e.id && Math.hypot(x - p.x, z - p.z) < 1.25) return false;
      }
      return true;
    };
    const clear = (x: number, z: number) => level(x, z) && level(x + bx * .95, z + bz * .95) && !!nav?.clear(x, z, .6) && nav.clear(x + bx * .5, z + bz * .5, .3) && nav.clear(x + bx * .95, z + bz * .95, .25) && separated(x, z);
    if (!clear(pose.x, pose.z)) search: for (const radius of [.7, 1.4, 2.1]) for (let i = 0; i < 8; i++) {
      const angle = e.transform.yaw + Math.PI / 2 + i * Math.PI / 4;
      const x = e.transform.x + Math.cos(angle) * radius, z = e.transform.z + Math.sin(angle) * radius;
      if (clear(x, z) && this.world.infected!.nav.visible(e.transform, { x, z }, .35)) { pose.x = x; pose.z = z; break search; }
    }
    this.corpses.set(e.id, pose); this.corpseSpatial.set(e.id, pose.x, pose.z); return pose;
  }
  /** alpha-white: the hit flash a figure draws. A pulse lasts 0.1 s of render time (Vfx), and never more than
   * hitFlashTicks of simulation: paused stepping (QA drivers, e2e) froze the render clock, so every Alpha hit
   * under fire stayed at peak white. Downed and dead bodies never flash: a corpse keeps its own look. */
  private flashStrength(e: { health: { current: number } }, feedback: { strength: number; at: number } | undefined): number {
    return feedback && e.health.current > 0 && this.world.tick - feedback.at <= hitFlashTicks ? feedback.strength : 0;
  }
  flash(id: number, strength: number): void {
    const e = this.world.entities.get(id); if (!e?.combat || e.faction !== 'infected') return;
    const feedback = this.feedback.get(id) ?? { mask: 0, strength: 0, at: -Infinity }; if (strength > feedback.strength) feedback.at = this.world.tick; feedback.strength = strength; this.feedback.set(id, feedback);
  }
  private limbPosition(id: number, limb: number) {
    const e = this.world.entities.get(id); if (!e?.combat || e.faction !== 'infected') return;
    const z = limb < 2 ? (limb === 0 ? -.3 : .3) : limb < 4 ? (limb === 2 ? -.12 : .12) : 0;
    return { x: e.transform.x + Math.sin(e.transform.yaw) * z, y: e.transform.y - .7 + (e.health.current <= 0 ? .18 : limb < 2 ? .65 : limb < 4 ? .25 : 1.15), z: e.transform.z + Math.cos(e.transform.yaw) * z };
  }
  detach(id: number, limb: number) {
    const position = this.limbPosition(id, limb); if (!position) return;
    const feedback = this.feedback.get(id) ?? { mask: 0, strength: 0, at: -Infinity }; feedback.mask |= 1 << limb; this.feedback.set(id, feedback); return position;
  }
  clearGore(): void { for (const feedback of this.feedback.values()) feedback.mask = 0; this.staticCorpses.reset(); }
  setGoreEnabled(enabled: boolean): void { if (this.goreEnabled !== enabled) this.staticCorpses.reset(); this.goreEnabled = enabled; }
  getGoreState() { return [...this.feedback].map(([id, f]) => ({ id, detached: ['armL', 'armR', 'legL', 'legR', 'head'].filter((_, i) => f.mask & (1 << i)), caps: ['armL_cap', 'armR_cap', 'legL_cap', 'legR_cap', 'head_cap'].filter((_, i) => f.mask & (1 << i)), visible: !this.world.entities.get(id)?.infected?.hidden })); }
  getState() {
    let instances = 0, draws = 0, objects = 0, nonInstanced = 0;
    this.traverse((node) => { if (node !== this) objects++; if (node instanceof InstancedMesh) { instances += node.count; if (node.count) draws++; } else if (node instanceof Mesh) nonInstanced++; });
    // Legacy probe fields: warnings now live in render.vfx.telegraphs.
    return { telegraphs: [0, 0], figures: [...this.batches.values()].flatMap(b => b.probe.figures).concat(this.staticCorpses.snapshot().figures), instances, meshDrawCalls: draws, objects, nonInstancedMeshes: nonInstanced, caps: this.caps.count, flashes: [...this.feedback.values()].filter(f => f.strength > 0).length, batches: [...this.batches.values()].map((b) => ({ id: b.role, lod: b.lod, instances: b.count, layout: crowdVertexLayout(b.mesh.geometry, b.mesh.instanceMatrix), source: b.placeholders ? 'placeholder' : 'glb' })).concat([...this.heroSlots.keys()].map(id => ({ id, lod: 'lod0', instances: 0, layout: { buffers: 0, locations: 0, webgpu: true, webgl2: true }, source: 'pending' }))), assets: this.logs };
  }
  dispose(): void {
    this.disposed = true; this.staticCorpses.dispose();
    for (const mesh of this.heroSlots.values()) { mesh.geometry.dispose(); (mesh.material as MeshLambertNodeMaterial).dispose(); mesh.dispose(); }
    this.heroSlots.clear();
    for (const geometry of this.corpseGeometry.values()) geometry.dispose();
    this.corpseGeometry.clear();
    for (const batch of this.batches.values()) { batch.mesh.geometry.dispose(); (batch.mesh.material as MeshLambertNodeMaterial).dispose(); batch.mesh.dispose(); batch.texture.dispose(); }
    for (const mesh of [this.shadows, this.caps]) { mesh.geometry.dispose(); (mesh.material as MeshBasicNodeMaterial).dispose(); mesh.dispose(); }
    this.batches.clear(); this.loadedModels.clear(); this.corpses.clear(); this.corpseSpatial.reset(); this.clear(); void this.registry.dispose();
  }
}
